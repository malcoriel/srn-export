import {
  ASTPath,
  ExportNamedDeclaration,
  Identifier,
  JSCodeshift,
  Property,
  TSPropertySignature,
  TSTypeAnnotation,
  TSTypeLiteral,
} from 'jscodeshift/src/core';
// @ts-ignore
import _ from 'lodash';
import {
  getTypeDeclaraiontName,
  isIdentifier,
  isTsTypeLiteral,
  isTsTypeReference,
  isTSUnionType,
} from './helpers';
import { TSTypeKind } from 'ast-types/gen/kinds';
import { namedTypes } from 'ast-types/gen/namedTypes';

// function makeProperties(j: JSCodeshift, targetType: TSTypeLiteral) {
//   return targetType.members
//     .map((m) => {
//       const tsProp = m as TSPropertySignature;
//       const name = (tsProp.key as Identifier).name;
//       if (name === 'tag') return null;
//     })
//     .filter((p) => !!p);
// }

const getPropNamesWithoutTag = (targetType: TSTypeLiteral): string[] => {
  return targetType.members
    .map((m) => {
      return ((m as TSPropertySignature).key as Identifier).name;
    })
    .filter((p) => p !== 'tag');
};

const buildParamsTypeAnnotation = (
  targetType: namedTypes.TSTypeLiteral,
  j: JSCodeshift
): TSTypeAnnotation => {
  const origTypeProps = targetType.members
    .map((m) => {
      return m as TSPropertySignature;
    })
    .filter((m) => (m.key as Identifier).name !== 'tag');

  return j.tsTypeAnnotation(j.tsTypeLiteral(origTypeProps));
};

const makeParams = (
  j: JSCodeshift,
  targetType: TSTypeLiteral
): namedTypes.ObjectPattern[] => {
  const names = getPropNamesWithoutTag(targetType);
  if (names.length === 0) {
    return [];
  }
  return [
    j.objectPattern.from({
      properties: names.map((n) => {
        return j.property.from({
          key: j.identifier(n),
          shorthand: true,
          value: j.identifier(n),
          kind: 'init',
        });
      }),
      typeAnnotation: buildParamsTypeAnnotation(targetType, j),
    }),
  ];
};

const makeProperties = (
  j: JSCodeshift,
  targetType: TSTypeLiteral
): Property[] => {
  const names = getPropNamesWithoutTag(targetType);
  if (names.length === 0) {
    return [];
  }
  return names.map((n) => {
    return j.property.from({
      key: j.identifier(n),
      shorthand: true,
      value: j.identifier(n),
      kind: 'init',
    });
  });
};

const makeBuilderMethod = (
  name: string,
  typeMap: Record<string, TSTypeKind>,
  j: JSCodeshift,
  mainTypeName: string
) => {
  const targetType = typeMap[name];
  if (!targetType || !isTsTypeLiteral(targetType)) {
    throw new Error(`Unsupported target type ${JSON.stringify(targetType)}`);
  }
  const tag = name.replace(mainTypeName, '');
  return j.arrowFunctionExpression.from({
    body: j.objectExpression([
      j.property('init', j.identifier('tag'), j.stringLiteral(tag)),
      ...makeProperties(j, targetType),
    ]),
    params: makeParams(j, targetType),
    expression: true,
    returnType: j.tsTypeAnnotation(j.tsTypeReference(j.identifier(name), null)),
  });
};

module.exports = function (file, api) {
  const j = api.jscodeshift;
  const typeMap: Record<string, TSTypeKind> = {};
  return (
    j(file.source)
      .find(j.ExportNamedDeclaration)
      .insertAfter((ex: ASTPath<ExportNamedDeclaration>) => {
        if (ex.value.declaration.type !== 'TSTypeAliasDeclaration') {
          return [];
        }
        const p = ex.value.declaration;
        const typeName = getTypeDeclaraiontName(p);
        if (!typeName) {
          return [];
        }

        const declaredType = p.typeAnnotation;
        typeMap[typeName] = declaredType;

        const union = declaredType;
        if (!isTSUnionType(union)) {
          return [];
        }
        const mainTypeName = typeName;

        return j.exportNamedDeclaration(
          j.classDeclaration(
            j.identifier(`${mainTypeName}Builder`),
            j.classBody(
              union.types
                .map((subType) => {
                  if (!isTsTypeReference(subType)) {
                    console.log('not reference');
                    return null;
                  }
                  if (!isIdentifier(subType.typeName)) {
                    return null;
                  }
                  return j.classProperty.from({
                    key: j.identifier(subType.typeName.name),
                    static: true,
                    accessibility: 'public',
                    declare: false,
                    value: makeBuilderMethod(
                      subType.typeName.name,
                      typeMap,
                      j,
                      mainTypeName
                    ),
                  });
                })
                .filter((t) => !!t)
            ),
            null
          )
        );
      })
      .toSource()
      // there is some bug either in my code or in generators,
      // but for makeProper buildParamsTypeAnnotation it outputs
      // weird double commas
      .replace(/,,/g, ',')
  );
};

module.exports.parser = 'ts';
export declare type PatternKind =
  | namedTypes.Identifier
  | namedTypes.RestElement
  | namedTypes.SpreadElementPattern
  | namedTypes.PropertyPattern
  | namedTypes.ObjectPattern
  | namedTypes.ArrayPattern
  | namedTypes.AssignmentPattern
  | namedTypes.SpreadPropertyPattern
  | namedTypes.JSXIdentifier
  | namedTypes.PrivateName
  | namedTypes.TSAsExpression
  | namedTypes.TSNonNullExpression
  | namedTypes.TSTypeParameter
  | namedTypes.TSTypeAssertion
  | namedTypes.TSParameterProperty;
