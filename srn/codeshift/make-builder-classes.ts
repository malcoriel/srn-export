import { ASTPath, ExportNamedDeclaration } from 'jscodeshift/src/core';
import { TSTypeKind } from 'ast-types/gen/kinds';
// @ts-ignore
import _ from 'lodash';
import { getUnionName, isTSUnionType } from './helpers';

module.exports = function (file, api) {
  const j = api.jscodeshift;
  return j(file.source)
    .find(j.ExportNamedDeclaration)
    .insertAfter((ex: ASTPath<ExportNamedDeclaration>) => {
      if (ex.value.declaration.type !== 'TSTypeAliasDeclaration') {
        console.log('not an alias export');
        return [];
      }
      const p = ex.value.declaration;
      const mainUnionName = getUnionName(p);
      if (!mainUnionName) {
        return [];
      }
      const union = p.typeAnnotation;
      if (!isTSUnionType(union)) {
        console.log('early exit', union.type);
        return [];
      }

      return j.classDeclaration(
        j.identifier(`${mainUnionName}Builder`),
        j.classBody([]),
        null
      );
    })
    .toSource();
};

module.exports.parser = 'ts';
