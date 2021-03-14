import {
  ASTPath,
  TSTypeAliasDeclaration,
  TSTypeReference,
  TSUnionType,
} from 'jscodeshift/src/core';

import { IdentifierKind } from 'ast-types/gen/kinds';
import { namedTypes } from 'ast-types/gen/namedTypes';

const isTSUnionType = (t: any): t is TSUnionType => {
  return t.type === 'TSUnionType';
};

const isTSTypeReference = (t: any): t is TSTypeReference => {
  return t.type === 'TSTypeReference';
};

const isIdentifier = (t: any): t is IdentifierKind => {
  return t.type === 'Identifier';
};

const getUnionName = (
  p: ASTPath<TSTypeAliasDeclaration>
): string | undefined => {
  const typeName = p.value.id;
  if (!isIdentifier(typeName)) {
    return;
  }
  return typeName.name;
};

module.exports = function (file, api) {
  const j = api.jscodeshift;
  const nameToAliases = {};
  return j(file.source)
    .find(j.TSTypeAliasDeclaration)
    .insertBefore((p: ASTPath<TSTypeAliasDeclaration>) => {
      const mainUnionName = getUnionName(p);
      if (!mainUnionName) {
        // not a union, not interesting
        return;
      }

      const union = p.value.typeAnnotation;
      if (!isTSUnionType(union)) {
        return;
      }
      const unionTypeNames = union.types
        .map((t) => {
          if (!isTSTypeReference(t)) {
            return null;
          }
          if (!isIdentifier(t.typeName)) {
            return null;
          }
          return t.typeName.name;
        })
        .filter((t) => !!t) as string[];
      const aliases = unionTypeNames.map((memberName) => {
        return [`${mainUnionName}${memberName}`, memberName];
      });
      nameToAliases[mainUnionName] = aliases.map((a) => a[0]);
      return aliases.map((first) =>
        j.typeAlias(j.identifier(first[0]), null, j.typeParameter(first[1]))
      );
    })
    .replaceWith((p: ASTPath<TSTypeAliasDeclaration>) => {
      const unionName = getUnionName(p);
      if (!unionName) {
        // not a union, not interesting
        return;
      }

      const aliases = nameToAliases[unionName];
      if (!aliases) {
        return p.value;
      }

      return j.exportNamedDeclaration(
        j.typeAlias(
          j.identifier(unionName),
          null,
          j.unionTypeAnnotation(aliases.map((a) => j.typeParameter(a)))
        )
      );
    })
    .toSource();
};
module.exports.parser = 'ts';

export declare type TSTypeKind =
  | namedTypes.TSExpressionWithTypeArguments
  | namedTypes.TSTypeReference
  | namedTypes.TSAnyKeyword
  | namedTypes.TSBigIntKeyword
  | namedTypes.TSBooleanKeyword
  | namedTypes.TSNeverKeyword
  | namedTypes.TSNullKeyword
  | namedTypes.TSNumberKeyword
  | namedTypes.TSObjectKeyword
  | namedTypes.TSStringKeyword
  | namedTypes.TSSymbolKeyword
  | namedTypes.TSUndefinedKeyword
  | namedTypes.TSUnknownKeyword
  | namedTypes.TSVoidKeyword
  | namedTypes.TSThisType
  | namedTypes.TSArrayType
  | namedTypes.TSLiteralType
  | namedTypes.TSUnionType
  | namedTypes.TSIntersectionType
  | namedTypes.TSConditionalType
  | namedTypes.TSInferType
  | namedTypes.TSParenthesizedType
  | namedTypes.TSFunctionType
  | namedTypes.TSConstructorType
  | namedTypes.TSMappedType
  | namedTypes.TSTupleType
  | namedTypes.TSNamedTupleMember
  | namedTypes.TSRestType
  | namedTypes.TSOptionalType
  | namedTypes.TSIndexedAccessType
  | namedTypes.TSTypeOperator
  | namedTypes.TSTypePredicate
  | namedTypes.TSTypeQuery
  | namedTypes.TSImportType
  | namedTypes.TSTypeLiteral;

export declare type FlowKind =
  | namedTypes.AnyTypeAnnotation
  | namedTypes.EmptyTypeAnnotation
  | namedTypes.MixedTypeAnnotation
  | namedTypes.VoidTypeAnnotation
  | namedTypes.SymbolTypeAnnotation
  | namedTypes.NumberTypeAnnotation
  | namedTypes.BigIntTypeAnnotation
  | namedTypes.NumberLiteralTypeAnnotation
  | namedTypes.NumericLiteralTypeAnnotation
  | namedTypes.BigIntLiteralTypeAnnotation
  | namedTypes.StringTypeAnnotation
  | namedTypes.StringLiteralTypeAnnotation
  | namedTypes.BooleanTypeAnnotation
  | namedTypes.BooleanLiteralTypeAnnotation
  | namedTypes.NullableTypeAnnotation
  | namedTypes.NullLiteralTypeAnnotation
  | namedTypes.NullTypeAnnotation
  | namedTypes.ThisTypeAnnotation
  | namedTypes.ExistsTypeAnnotation
  | namedTypes.ExistentialTypeParam
  | namedTypes.FunctionTypeAnnotation
  | namedTypes.ArrayTypeAnnotation
  | namedTypes.ObjectTypeAnnotation
  | namedTypes.GenericTypeAnnotation
  | namedTypes.MemberTypeAnnotation
  | namedTypes.UnionTypeAnnotation
  | namedTypes.IntersectionTypeAnnotation
  | namedTypes.TypeofTypeAnnotation
  | namedTypes.TypeParameter
  | namedTypes.InterfaceTypeAnnotation
  | namedTypes.TupleTypeAnnotation
  | namedTypes.InferredPredicate
  | namedTypes.DeclaredPredicate;

export declare type FlowTypeKind =
  | namedTypes.AnyTypeAnnotation
  | namedTypes.EmptyTypeAnnotation
  | namedTypes.MixedTypeAnnotation
  | namedTypes.VoidTypeAnnotation
  | namedTypes.SymbolTypeAnnotation
  | namedTypes.NumberTypeAnnotation
  | namedTypes.BigIntTypeAnnotation
  | namedTypes.NumberLiteralTypeAnnotation
  | namedTypes.NumericLiteralTypeAnnotation
  | namedTypes.BigIntLiteralTypeAnnotation
  | namedTypes.StringTypeAnnotation
  | namedTypes.StringLiteralTypeAnnotation
  | namedTypes.BooleanTypeAnnotation
  | namedTypes.BooleanLiteralTypeAnnotation
  | namedTypes.NullableTypeAnnotation
  | namedTypes.NullLiteralTypeAnnotation
  | namedTypes.NullTypeAnnotation
  | namedTypes.ThisTypeAnnotation
  | namedTypes.ExistsTypeAnnotation
  | namedTypes.ExistentialTypeParam
  | namedTypes.FunctionTypeAnnotation
  | namedTypes.ArrayTypeAnnotation
  | namedTypes.ObjectTypeAnnotation
  | namedTypes.GenericTypeAnnotation
  | namedTypes.MemberTypeAnnotation
  | namedTypes.UnionTypeAnnotation
  | namedTypes.IntersectionTypeAnnotation
  | namedTypes.TypeofTypeAnnotation
  | namedTypes.TypeParameter
  | namedTypes.InterfaceTypeAnnotation
  | namedTypes.TupleTypeAnnotation;

export declare type ExpressionKind =
  | namedTypes.Identifier
  | namedTypes.FunctionExpression
  | namedTypes.ThisExpression
  | namedTypes.ArrayExpression
  | namedTypes.ObjectExpression
  | namedTypes.Literal
  | namedTypes.SequenceExpression
  | namedTypes.UnaryExpression
  | namedTypes.BinaryExpression
  | namedTypes.AssignmentExpression
  | namedTypes.MemberExpression
  | namedTypes.UpdateExpression
  | namedTypes.LogicalExpression
  | namedTypes.ConditionalExpression
  | namedTypes.NewExpression
  | namedTypes.CallExpression
  | namedTypes.ArrowFunctionExpression
  | namedTypes.YieldExpression
  | namedTypes.GeneratorExpression
  | namedTypes.ComprehensionExpression
  | namedTypes.ClassExpression
  | namedTypes.Super
  | namedTypes.TaggedTemplateExpression
  | namedTypes.TemplateLiteral
  | namedTypes.MetaProperty
  | namedTypes.AwaitExpression
  | namedTypes.ImportExpression
  | namedTypes.ChainExpression
  | namedTypes.OptionalCallExpression
  | namedTypes.OptionalMemberExpression
  | namedTypes.JSXIdentifier
  | namedTypes.JSXExpressionContainer
  | namedTypes.JSXElement
  | namedTypes.JSXFragment
  | namedTypes.JSXMemberExpression
  | namedTypes.JSXText
  | namedTypes.PrivateName
  | namedTypes.TypeCastExpression
  | namedTypes.DoExpression
  | namedTypes.BindExpression
  | namedTypes.ParenthesizedExpression
  | namedTypes.DirectiveLiteral
  | namedTypes.StringLiteral
  | namedTypes.NumericLiteral
  | namedTypes.BigIntLiteral
  | namedTypes.NullLiteral
  | namedTypes.BooleanLiteral
  | namedTypes.RegExpLiteral
  | namedTypes.Import
  | namedTypes.TSAsExpression
  | namedTypes.TSNonNullExpression
  | namedTypes.TSTypeParameter
  | namedTypes.TSTypeAssertion;
