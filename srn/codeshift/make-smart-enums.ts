import {
  ASTPath,
  ExportNamedDeclaration,
  JSCodeshift,
  ObjectTypeProperty,
  TSLiteralType,
  TSPropertySignature,
  TSTypeAliasDeclaration,
  TSTypeLiteral,
  TSTypeReference,
  TSUnionType,
} from 'jscodeshift/src/core';

import { IdentifierKind } from 'ast-types/gen/kinds';
import {
  AnyTypeAnnotationBuilder,
  ArrayExpressionBuilder,
  ArrayPatternBuilder,
  ArrayTypeAnnotationBuilder,
  ArrowFunctionExpressionBuilder,
  AssignmentExpressionBuilder,
  AssignmentPatternBuilder,
  AwaitExpressionBuilder,
  BigIntLiteralBuilder,
  BigIntLiteralTypeAnnotationBuilder,
  BigIntTypeAnnotationBuilder,
  BinaryExpressionBuilder,
  BindExpressionBuilder,
  BlockBuilder,
  BlockStatementBuilder,
  BooleanLiteralBuilder,
  BooleanLiteralTypeAnnotationBuilder,
  BooleanTypeAnnotationBuilder,
  BreakStatementBuilder,
  CallExpressionBuilder,
  CatchClauseBuilder,
  ChainExpressionBuilder,
  ClassBodyBuilder,
  ClassDeclarationBuilder,
  ClassExpressionBuilder,
  ClassImplementsBuilder,
  ClassMethodBuilder,
  ClassPrivateMethodBuilder,
  ClassPrivatePropertyBuilder,
  ClassPropertyBuilder,
  ClassPropertyDefinitionBuilder,
  CommentBlockBuilder,
  CommentLineBuilder,
  ComprehensionBlockBuilder,
  ComprehensionExpressionBuilder,
  ConditionalExpressionBuilder,
  ContinueStatementBuilder,
  DebuggerStatementBuilder,
  DeclareClassBuilder,
  DeclaredPredicateBuilder,
  DeclareExportAllDeclarationBuilder,
  DeclareExportDeclarationBuilder,
  DeclareFunctionBuilder,
  DeclareInterfaceBuilder,
  DeclareModuleBuilder,
  DeclareModuleExportsBuilder,
  DeclareOpaqueTypeBuilder,
  DeclareTypeAliasBuilder,
  DeclareVariableBuilder,
  DecoratorBuilder,
  DirectiveBuilder,
  DirectiveLiteralBuilder,
  DoExpressionBuilder,
  DoWhileStatementBuilder,
  EmptyStatementBuilder,
  EmptyTypeAnnotationBuilder,
  EnumBooleanBodyBuilder,
  EnumBooleanMemberBuilder,
  EnumDeclarationBuilder,
  EnumDefaultedMemberBuilder,
  EnumNumberBodyBuilder,
  EnumNumberMemberBuilder,
  EnumStringBodyBuilder,
  EnumStringMemberBuilder,
  EnumSymbolBodyBuilder,
  ExistentialTypeParamBuilder,
  ExistsTypeAnnotationBuilder,
  ExportAllDeclarationBuilder,
  ExportBatchSpecifierBuilder,
  ExportDeclarationBuilder,
  ExportDefaultDeclarationBuilder,
  ExportDefaultSpecifierBuilder,
  ExportNamedDeclarationBuilder,
  ExportNamespaceSpecifierBuilder,
  ExportSpecifierBuilder,
  ExpressionStatementBuilder,
  FileBuilder,
  ForAwaitStatementBuilder,
  ForInStatementBuilder,
  ForOfStatementBuilder,
  ForStatementBuilder,
  FunctionDeclarationBuilder,
  FunctionExpressionBuilder,
  FunctionTypeAnnotationBuilder,
  FunctionTypeParamBuilder,
  GeneratorExpressionBuilder,
  GenericTypeAnnotationBuilder,
  IdentifierBuilder,
  IfStatementBuilder,
  ImportBuilder,
  ImportDeclarationBuilder,
  ImportDefaultSpecifierBuilder,
  ImportExpressionBuilder,
  ImportNamespaceSpecifierBuilder,
  ImportSpecifierBuilder,
  InferredPredicateBuilder,
  InterfaceDeclarationBuilder,
  InterfaceExtendsBuilder,
  InterfaceTypeAnnotationBuilder,
  InterpreterDirectiveBuilder,
  IntersectionTypeAnnotationBuilder,
  JSXAttributeBuilder,
  JSXClosingElementBuilder,
  JSXClosingFragmentBuilder,
  JSXElementBuilder,
  JSXEmptyExpressionBuilder,
  JSXExpressionContainerBuilder,
  JSXFragmentBuilder,
  JSXIdentifierBuilder,
  JSXMemberExpressionBuilder,
  JSXNamespacedNameBuilder,
  JSXOpeningElementBuilder,
  JSXOpeningFragmentBuilder,
  JSXSpreadAttributeBuilder,
  JSXSpreadChildBuilder,
  JSXTextBuilder,
  LabeledStatementBuilder,
  LineBuilder,
  LiteralBuilder,
  LogicalExpressionBuilder,
  MemberExpressionBuilder,
  MemberTypeAnnotationBuilder,
  MetaPropertyBuilder,
  MethodDefinitionBuilder,
  MixedTypeAnnotationBuilder,
  NewExpressionBuilder,
  NoopBuilder,
  NullableTypeAnnotationBuilder,
  NullLiteralBuilder,
  NullLiteralTypeAnnotationBuilder,
  NullTypeAnnotationBuilder,
  NumberLiteralTypeAnnotationBuilder,
  NumberTypeAnnotationBuilder,
  NumericLiteralBuilder,
  NumericLiteralTypeAnnotationBuilder,
  ObjectExpressionBuilder,
  ObjectMethodBuilder,
  ObjectPatternBuilder,
  ObjectPropertyBuilder,
  ObjectTypeAnnotationBuilder,
  ObjectTypeCallPropertyBuilder,
  ObjectTypeIndexerBuilder,
  ObjectTypeInternalSlotBuilder,
  ObjectTypePropertyBuilder,
  ObjectTypeSpreadPropertyBuilder,
  OpaqueTypeBuilder,
  OptionalCallExpressionBuilder,
  OptionalMemberExpressionBuilder,
  ParenthesizedExpressionBuilder,
  PrivateNameBuilder,
  ProgramBuilder,
  PropertyBuilder,
  PropertyPatternBuilder,
  QualifiedTypeIdentifierBuilder,
  RegExpLiteralBuilder,
  RestElementBuilder,
  RestPropertyBuilder,
  ReturnStatementBuilder,
  SequenceExpressionBuilder,
  SpreadElementBuilder,
  SpreadElementPatternBuilder,
  SpreadPropertyBuilder,
  SpreadPropertyPatternBuilder,
  StringLiteralBuilder,
  StringLiteralTypeAnnotationBuilder,
  StringTypeAnnotationBuilder,
  SuperBuilder,
  SwitchCaseBuilder,
  SwitchStatementBuilder,
  SymbolTypeAnnotationBuilder,
  TaggedTemplateExpressionBuilder,
  TemplateElementBuilder,
  TemplateLiteralBuilder,
  ThisExpressionBuilder,
  ThisTypeAnnotationBuilder,
  ThrowStatementBuilder,
  TryStatementBuilder,
  TSAnyKeywordBuilder,
  TSArrayTypeBuilder,
  TSAsExpressionBuilder,
  TSBigIntKeywordBuilder,
  TSBooleanKeywordBuilder,
  TSCallSignatureDeclarationBuilder,
  TSConditionalTypeBuilder,
  TSConstructorTypeBuilder,
  TSConstructSignatureDeclarationBuilder,
  TSDeclareFunctionBuilder,
  TSDeclareMethodBuilder,
  TSEnumDeclarationBuilder,
  TSEnumMemberBuilder,
  TSExportAssignmentBuilder,
  TSExpressionWithTypeArgumentsBuilder,
  TSExternalModuleReferenceBuilder,
  TSFunctionTypeBuilder,
  TSImportEqualsDeclarationBuilder,
  TSImportTypeBuilder,
  TSIndexedAccessTypeBuilder,
  TSIndexSignatureBuilder,
  TSInferTypeBuilder,
  TSInterfaceBodyBuilder,
  TSInterfaceDeclarationBuilder,
  TSIntersectionTypeBuilder,
  TSLiteralTypeBuilder,
  TSMappedTypeBuilder,
  TSMethodSignatureBuilder,
  TSModuleBlockBuilder,
  TSModuleDeclarationBuilder,
  TSNamedTupleMemberBuilder,
  TSNamespaceExportDeclarationBuilder,
  TSNeverKeywordBuilder,
  TSNonNullExpressionBuilder,
  TSNullKeywordBuilder,
  TSNumberKeywordBuilder,
  TSObjectKeywordBuilder,
  TSOptionalTypeBuilder,
  TSParameterPropertyBuilder,
  TSParenthesizedTypeBuilder,
  TSPropertySignatureBuilder,
  TSQualifiedNameBuilder,
  TSRestTypeBuilder,
  TSStringKeywordBuilder,
  TSSymbolKeywordBuilder,
  TSThisTypeBuilder,
  TSTupleTypeBuilder,
  TSTypeAliasDeclarationBuilder,
  TSTypeAnnotationBuilder,
  TSTypeAssertionBuilder,
  TSTypeLiteralBuilder,
  TSTypeOperatorBuilder,
  TSTypeParameterBuilder,
  TSTypeParameterDeclarationBuilder,
  TSTypeParameterInstantiationBuilder,
  TSTypePredicateBuilder,
  TSTypeQueryBuilder,
  TSTypeReferenceBuilder,
  TSUndefinedKeywordBuilder,
  TSUnionTypeBuilder,
  TSUnknownKeywordBuilder,
  TSVoidKeywordBuilder,
  TupleTypeAnnotationBuilder,
  TypeAliasBuilder,
  TypeAnnotationBuilder,
  TypeCastExpressionBuilder,
  TypeofTypeAnnotationBuilder,
  TypeParameterBuilder,
  TypeParameterDeclarationBuilder,
  TypeParameterInstantiationBuilder,
  UnaryExpressionBuilder,
  UnionTypeAnnotationBuilder,
  UpdateExpressionBuilder,
  VariableDeclarationBuilder,
  VariableDeclaratorBuilder,
  VarianceBuilder,
  VoidTypeAnnotationBuilder,
  WhileStatementBuilder,
  WithStatementBuilder,
  YieldExpressionBuilder,
} from 'ast-types/gen/builders';
import { namedTypes } from 'ast-types/gen/namedTypes';
// @ts-ignore
import _ from 'lodash';

const isTSUnionType = (t: any): t is TSUnionType => {
  return t.type === 'TSUnionType';
};

const isTSTypeReference = (t: any): t is TSTypeReference => {
  return t.type === 'TSTypeReference';
};

const isIdentifier = (t: any): t is IdentifierKind => {
  return t.type === 'Identifier';
};

const isTsTypeLiteral = (t: any): t is TSTypeLiteral => {
  return t.type === 'TSTypeLiteral';
};

const isTsLiteralType = (t: any): t is TSLiteralType => {
  return t.type === 'TSLiteralType';
};

const isTsPropertySignature = (t: any): t is TSPropertySignature => {
  return t.type === 'TSPropertySignature';
};

const getUnionName = (p: TSTypeAliasDeclaration): string | undefined => {
  const typeName = p.id;
  if (!isIdentifier(typeName)) {
    return;
  }
  return typeName.name;
};

const convertTsTypeIntoFlowType = (t: TSTypeKind, j: JSCodeshift): FlowKind => {
  if (t.type !== 'TSTypeLiteral') {
    throw new Error(`Unsupported ts type ${t.type}`);
  }

  return j.objectTypeAnnotation(
    t.members.map(
      (
        tsMember:
          | namedTypes.TSCallSignatureDeclaration
          | namedTypes.TSConstructSignatureDeclaration
          | namedTypes.TSIndexSignature
          | namedTypes.TSMethodSignature
          | namedTypes.TSPropertySignature
      ): ObjectTypeProperty => {
        if (tsMember.type !== 'TSPropertySignature') {
          throw new Error(`Unsupported object member type ${tsMember.type}`);
        }
        if (tsMember.key.type !== 'Identifier') {
          throw new Error(
            `Unsupported object member key type ${tsMember.key.type}`
          );
        }
        // console.log(tsMember);

        const memberValue = tsMember.typeAnnotation.typeAnnotation;

        let newMemberValue: FlowTypeKind;
        if (memberValue.type === 'TSTypeReference') {
          if (memberValue.typeName.type === 'Identifier') {
            newMemberValue = j.typeParameter(memberValue.typeName.name);
          }
        } else if (memberValue.type === 'TSNumberKeyword') {
          newMemberValue = j.numberTypeAnnotation();
        } else if (memberValue.type === 'TSStringKeyword') {
          newMemberValue = j.stringTypeAnnotation();
        } else if (memberValue.type === 'TSLiteralType') {
          if (memberValue.literal.type === 'StringLiteral') {
            newMemberValue = j.stringLiteralTypeAnnotation(
              memberValue.literal.value,
              memberValue.literal.value
            );
          }
        }

        if (!newMemberValue) {
          throw new Error(`Unsupported member value type: ${memberValue.type}`);
        }

        return j.objectTypeProperty(
          tsMember.key,
          newMemberValue,
          tsMember.optional
        );
      }
    )
  );
};

module.exports = function (file, api) {
  const j = api.jscodeshift;
  const nameToAliases = {};
  return j(file.source)
    .find(j.ExportNamedDeclaration)
    .replaceWith((ex: ASTPath<ExportNamedDeclaration>) => {
      if (ex.value.declaration.type !== 'TSTypeAliasDeclaration') {
        return ex.value;
      }
      const p = ex.value.declaration;
      const mainUnionName = getUnionName(p);
      if (!mainUnionName) {
        // not a union, not interesting
        return ex.value;
      }

      const union = p.typeAnnotation;
      if (!isTSUnionType(union)) {
        console.log('early exit', union.type);
        return ex.value;
      }
      const typesWithNames = union.types
        .map((t) => {
          if (isTSTypeReference(t) && isIdentifier(t.typeName)) {
            return [t, t.typeName.name];
          }
          if (isTsTypeLiteral(t)) {
            let tagName = null;
            for (const member of t.members) {
              if (isTsPropertySignature(member)) {
                if (isIdentifier(member.key)) {
                  if (member.key.name === 'tag') {
                    const typeAnnotation = member.typeAnnotation;
                    // @ts-ignore
                    tagName = typeAnnotation.typeAnnotation.literal.value;
                  }
                }
              }
            }
            return [t, tagName];
          }
          return null;
        })
        .filter((t) => !!t) as [TSTypeKind, string][];
      const aliases = typesWithNames.map((typeAndName) => {
        return [`${mainUnionName}${typeAndName[1]}`, typeAndName[1]];
      });
      const typesByName = _.mapValues(
        _.keyBy(typesWithNames, (p) => p[1]),
        (v) => v[0]
      );
      nameToAliases[mainUnionName] = aliases.map((a) => a[0]);
      const insertedDeclarations = aliases
        .map(([fullMemberName, shortMemberName]) => {
          const movedType = typesByName[shortMemberName];
          if (movedType && movedType.type === 'TSTypeReference') {
            return j.typeAlias(
              j.identifier(fullMemberName),
              null,
              j.typeParameter(shortMemberName)
            );
          }
          if (movedType && movedType.type === 'TSTypeLiteral') {
            const convertedObjectType = convertTsTypeIntoFlowType(movedType, j);
            return j.typeAlias(
              j.identifier(fullMemberName),
              null,
              convertedObjectType
            );
          }
          return null;
        })
        .filter((d) => !!d);
      const unionName = getUnionName(p);
      if (!unionName) {
        // not a union, not interesting
        console.log('not a union');
        return ex.value;
      }

      const aliases2 = nameToAliases[unionName];
      if (!aliases2) {
        console.log('no aliases');
        return ex.value;
      }

      return [
        ...insertedDeclarations,

        j.exportNamedDeclaration(
          j.typeAlias(
            j.identifier(unionName),
            null,
            j.unionTypeAnnotation(aliases2.map((a) => j.typeParameter(a)))
          )
        ),
      ];
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

export interface builders {
  file: FileBuilder;
  program: ProgramBuilder;
  identifier: IdentifierBuilder;
  blockStatement: BlockStatementBuilder;
  emptyStatement: EmptyStatementBuilder;
  expressionStatement: ExpressionStatementBuilder;
  ifStatement: IfStatementBuilder;
  labeledStatement: LabeledStatementBuilder;
  breakStatement: BreakStatementBuilder;
  continueStatement: ContinueStatementBuilder;
  withStatement: WithStatementBuilder;
  switchStatement: SwitchStatementBuilder;
  switchCase: SwitchCaseBuilder;
  returnStatement: ReturnStatementBuilder;
  throwStatement: ThrowStatementBuilder;
  tryStatement: TryStatementBuilder;
  catchClause: CatchClauseBuilder;
  whileStatement: WhileStatementBuilder;
  doWhileStatement: DoWhileStatementBuilder;
  forStatement: ForStatementBuilder;
  variableDeclaration: VariableDeclarationBuilder;
  forInStatement: ForInStatementBuilder;
  debuggerStatement: DebuggerStatementBuilder;
  functionDeclaration: FunctionDeclarationBuilder;
  functionExpression: FunctionExpressionBuilder;
  variableDeclarator: VariableDeclaratorBuilder;
  thisExpression: ThisExpressionBuilder;
  arrayExpression: ArrayExpressionBuilder;
  objectExpression: ObjectExpressionBuilder;
  property: PropertyBuilder;
  literal: LiteralBuilder;
  sequenceExpression: SequenceExpressionBuilder;
  unaryExpression: UnaryExpressionBuilder;
  binaryExpression: BinaryExpressionBuilder;
  assignmentExpression: AssignmentExpressionBuilder;
  memberExpression: MemberExpressionBuilder;
  updateExpression: UpdateExpressionBuilder;
  logicalExpression: LogicalExpressionBuilder;
  conditionalExpression: ConditionalExpressionBuilder;
  newExpression: NewExpressionBuilder;
  callExpression: CallExpressionBuilder;
  restElement: RestElementBuilder;
  typeAnnotation: TypeAnnotationBuilder;
  tsTypeAnnotation: TSTypeAnnotationBuilder;
  spreadElementPattern: SpreadElementPatternBuilder;
  arrowFunctionExpression: ArrowFunctionExpressionBuilder;
  forOfStatement: ForOfStatementBuilder;
  yieldExpression: YieldExpressionBuilder;
  generatorExpression: GeneratorExpressionBuilder;
  comprehensionBlock: ComprehensionBlockBuilder;
  comprehensionExpression: ComprehensionExpressionBuilder;
  objectProperty: ObjectPropertyBuilder;
  propertyPattern: PropertyPatternBuilder;
  objectPattern: ObjectPatternBuilder;
  arrayPattern: ArrayPatternBuilder;
  spreadElement: SpreadElementBuilder;
  assignmentPattern: AssignmentPatternBuilder;
  methodDefinition: MethodDefinitionBuilder;
  classPropertyDefinition: ClassPropertyDefinitionBuilder;
  classProperty: ClassPropertyBuilder;
  classBody: ClassBodyBuilder;
  classDeclaration: ClassDeclarationBuilder;
  classExpression: ClassExpressionBuilder;
  super: SuperBuilder;
  importSpecifier: ImportSpecifierBuilder;
  importDefaultSpecifier: ImportDefaultSpecifierBuilder;
  importNamespaceSpecifier: ImportNamespaceSpecifierBuilder;
  importDeclaration: ImportDeclarationBuilder;
  exportNamedDeclaration: ExportNamedDeclarationBuilder;
  exportSpecifier: ExportSpecifierBuilder;
  exportDefaultDeclaration: ExportDefaultDeclarationBuilder;
  exportAllDeclaration: ExportAllDeclarationBuilder;
  taggedTemplateExpression: TaggedTemplateExpressionBuilder;
  templateLiteral: TemplateLiteralBuilder;
  templateElement: TemplateElementBuilder;
  metaProperty: MetaPropertyBuilder;
  awaitExpression: AwaitExpressionBuilder;
  spreadProperty: SpreadPropertyBuilder;
  spreadPropertyPattern: SpreadPropertyPatternBuilder;
  importExpression: ImportExpressionBuilder;
  chainExpression: ChainExpressionBuilder;
  optionalCallExpression: OptionalCallExpressionBuilder;
  optionalMemberExpression: OptionalMemberExpressionBuilder;
  jsxAttribute: JSXAttributeBuilder;
  jsxIdentifier: JSXIdentifierBuilder;
  jsxNamespacedName: JSXNamespacedNameBuilder;
  jsxExpressionContainer: JSXExpressionContainerBuilder;
  jsxElement: JSXElementBuilder;
  jsxFragment: JSXFragmentBuilder;
  jsxMemberExpression: JSXMemberExpressionBuilder;
  jsxSpreadAttribute: JSXSpreadAttributeBuilder;
  jsxEmptyExpression: JSXEmptyExpressionBuilder;
  jsxText: JSXTextBuilder;
  jsxSpreadChild: JSXSpreadChildBuilder;
  jsxOpeningElement: JSXOpeningElementBuilder;
  jsxClosingElement: JSXClosingElementBuilder;
  jsxOpeningFragment: JSXOpeningFragmentBuilder;
  jsxClosingFragment: JSXClosingFragmentBuilder;
  decorator: DecoratorBuilder;
  privateName: PrivateNameBuilder;
  classPrivateProperty: ClassPrivatePropertyBuilder;
  typeParameterDeclaration: TypeParameterDeclarationBuilder;
  tsTypeParameterDeclaration: TSTypeParameterDeclarationBuilder;
  typeParameterInstantiation: TypeParameterInstantiationBuilder;
  tsTypeParameterInstantiation: TSTypeParameterInstantiationBuilder;
  classImplements: ClassImplementsBuilder;
  tsExpressionWithTypeArguments: TSExpressionWithTypeArgumentsBuilder;
  anyTypeAnnotation: AnyTypeAnnotationBuilder;
  emptyTypeAnnotation: EmptyTypeAnnotationBuilder;
  mixedTypeAnnotation: MixedTypeAnnotationBuilder;
  voidTypeAnnotation: VoidTypeAnnotationBuilder;
  symbolTypeAnnotation: SymbolTypeAnnotationBuilder;
  numberTypeAnnotation: NumberTypeAnnotationBuilder;
  bigIntTypeAnnotation: BigIntTypeAnnotationBuilder;
  numberLiteralTypeAnnotation: NumberLiteralTypeAnnotationBuilder;
  numericLiteralTypeAnnotation: NumericLiteralTypeAnnotationBuilder;
  bigIntLiteralTypeAnnotation: BigIntLiteralTypeAnnotationBuilder;
  stringTypeAnnotation: StringTypeAnnotationBuilder;
  stringLiteralTypeAnnotation: StringLiteralTypeAnnotationBuilder;
  booleanTypeAnnotation: BooleanTypeAnnotationBuilder;
  booleanLiteralTypeAnnotation: BooleanLiteralTypeAnnotationBuilder;
  nullableTypeAnnotation: NullableTypeAnnotationBuilder;
  nullLiteralTypeAnnotation: NullLiteralTypeAnnotationBuilder;
  nullTypeAnnotation: NullTypeAnnotationBuilder;
  thisTypeAnnotation: ThisTypeAnnotationBuilder;
  existsTypeAnnotation: ExistsTypeAnnotationBuilder;
  existentialTypeParam: ExistentialTypeParamBuilder;
  functionTypeAnnotation: FunctionTypeAnnotationBuilder;
  functionTypeParam: FunctionTypeParamBuilder;
  arrayTypeAnnotation: ArrayTypeAnnotationBuilder;
  objectTypeAnnotation: ObjectTypeAnnotationBuilder;
  objectTypeProperty: ObjectTypePropertyBuilder;
  objectTypeSpreadProperty: ObjectTypeSpreadPropertyBuilder;
  objectTypeIndexer: ObjectTypeIndexerBuilder;
  objectTypeCallProperty: ObjectTypeCallPropertyBuilder;
  objectTypeInternalSlot: ObjectTypeInternalSlotBuilder;
  variance: VarianceBuilder;
  qualifiedTypeIdentifier: QualifiedTypeIdentifierBuilder;
  genericTypeAnnotation: GenericTypeAnnotationBuilder;
  memberTypeAnnotation: MemberTypeAnnotationBuilder;
  unionTypeAnnotation: UnionTypeAnnotationBuilder;
  intersectionTypeAnnotation: IntersectionTypeAnnotationBuilder;
  typeofTypeAnnotation: TypeofTypeAnnotationBuilder;
  typeParameter: TypeParameterBuilder;
  interfaceTypeAnnotation: InterfaceTypeAnnotationBuilder;
  interfaceExtends: InterfaceExtendsBuilder;
  interfaceDeclaration: InterfaceDeclarationBuilder;
  declareInterface: DeclareInterfaceBuilder;
  typeAlias: TypeAliasBuilder;
  declareTypeAlias: DeclareTypeAliasBuilder;
  opaqueType: OpaqueTypeBuilder;
  declareOpaqueType: DeclareOpaqueTypeBuilder;
  typeCastExpression: TypeCastExpressionBuilder;
  tupleTypeAnnotation: TupleTypeAnnotationBuilder;
  declareVariable: DeclareVariableBuilder;
  declareFunction: DeclareFunctionBuilder;
  declareClass: DeclareClassBuilder;
  declareModule: DeclareModuleBuilder;
  declareModuleExports: DeclareModuleExportsBuilder;
  declareExportDeclaration: DeclareExportDeclarationBuilder;
  exportBatchSpecifier: ExportBatchSpecifierBuilder;
  declareExportAllDeclaration: DeclareExportAllDeclarationBuilder;
  inferredPredicate: InferredPredicateBuilder;
  declaredPredicate: DeclaredPredicateBuilder;
  enumDeclaration: EnumDeclarationBuilder;
  enumBooleanBody: EnumBooleanBodyBuilder;
  enumNumberBody: EnumNumberBodyBuilder;
  enumStringBody: EnumStringBodyBuilder;
  enumSymbolBody: EnumSymbolBodyBuilder;
  enumBooleanMember: EnumBooleanMemberBuilder;
  enumNumberMember: EnumNumberMemberBuilder;
  enumStringMember: EnumStringMemberBuilder;
  enumDefaultedMember: EnumDefaultedMemberBuilder;
  exportDeclaration: ExportDeclarationBuilder;
  block: BlockBuilder;
  line: LineBuilder;
  noop: NoopBuilder;
  doExpression: DoExpressionBuilder;
  bindExpression: BindExpressionBuilder;
  parenthesizedExpression: ParenthesizedExpressionBuilder;
  exportNamespaceSpecifier: ExportNamespaceSpecifierBuilder;
  exportDefaultSpecifier: ExportDefaultSpecifierBuilder;
  commentBlock: CommentBlockBuilder;
  commentLine: CommentLineBuilder;
  directive: DirectiveBuilder;
  directiveLiteral: DirectiveLiteralBuilder;
  interpreterDirective: InterpreterDirectiveBuilder;
  stringLiteral: StringLiteralBuilder;
  numericLiteral: NumericLiteralBuilder;
  bigIntLiteral: BigIntLiteralBuilder;
  nullLiteral: NullLiteralBuilder;
  booleanLiteral: BooleanLiteralBuilder;
  regExpLiteral: RegExpLiteralBuilder;
  objectMethod: ObjectMethodBuilder;
  classMethod: ClassMethodBuilder;
  classPrivateMethod: ClassPrivateMethodBuilder;
  restProperty: RestPropertyBuilder;
  forAwaitStatement: ForAwaitStatementBuilder;
  import: ImportBuilder;
  tsQualifiedName: TSQualifiedNameBuilder;
  tsTypeReference: TSTypeReferenceBuilder;
  tsAsExpression: TSAsExpressionBuilder;
  tsNonNullExpression: TSNonNullExpressionBuilder;
  tsAnyKeyword: TSAnyKeywordBuilder;
  tsBigIntKeyword: TSBigIntKeywordBuilder;
  tsBooleanKeyword: TSBooleanKeywordBuilder;
  tsNeverKeyword: TSNeverKeywordBuilder;
  tsNullKeyword: TSNullKeywordBuilder;
  tsNumberKeyword: TSNumberKeywordBuilder;
  tsObjectKeyword: TSObjectKeywordBuilder;
  tsStringKeyword: TSStringKeywordBuilder;
  tsSymbolKeyword: TSSymbolKeywordBuilder;
  tsUndefinedKeyword: TSUndefinedKeywordBuilder;
  tsUnknownKeyword: TSUnknownKeywordBuilder;
  tsVoidKeyword: TSVoidKeywordBuilder;
  tsThisType: TSThisTypeBuilder;
  tsArrayType: TSArrayTypeBuilder;
  tsLiteralType: TSLiteralTypeBuilder;
  tsUnionType: TSUnionTypeBuilder;
  tsIntersectionType: TSIntersectionTypeBuilder;
  tsConditionalType: TSConditionalTypeBuilder;
  tsInferType: TSInferTypeBuilder;
  tsTypeParameter: TSTypeParameterBuilder;
  tsParenthesizedType: TSParenthesizedTypeBuilder;
  tsFunctionType: TSFunctionTypeBuilder;
  tsConstructorType: TSConstructorTypeBuilder;
  tsDeclareFunction: TSDeclareFunctionBuilder;
  tsDeclareMethod: TSDeclareMethodBuilder;
  tsMappedType: TSMappedTypeBuilder;
  tsTupleType: TSTupleTypeBuilder;
  tsNamedTupleMember: TSNamedTupleMemberBuilder;
  tsRestType: TSRestTypeBuilder;
  tsOptionalType: TSOptionalTypeBuilder;
  tsIndexedAccessType: TSIndexedAccessTypeBuilder;
  tsTypeOperator: TSTypeOperatorBuilder;
  tsIndexSignature: TSIndexSignatureBuilder;
  tsPropertySignature: TSPropertySignatureBuilder;
  tsMethodSignature: TSMethodSignatureBuilder;
  tsTypePredicate: TSTypePredicateBuilder;
  tsCallSignatureDeclaration: TSCallSignatureDeclarationBuilder;
  tsConstructSignatureDeclaration: TSConstructSignatureDeclarationBuilder;
  tsEnumMember: TSEnumMemberBuilder;
  tsTypeQuery: TSTypeQueryBuilder;
  tsImportType: TSImportTypeBuilder;
  tsTypeLiteral: TSTypeLiteralBuilder;
  tsTypeAssertion: TSTypeAssertionBuilder;
  tsEnumDeclaration: TSEnumDeclarationBuilder;
  tsTypeAliasDeclaration: TSTypeAliasDeclarationBuilder;
  tsModuleBlock: TSModuleBlockBuilder;
  tsModuleDeclaration: TSModuleDeclarationBuilder;
  tsImportEqualsDeclaration: TSImportEqualsDeclarationBuilder;
  tsExternalModuleReference: TSExternalModuleReferenceBuilder;
  tsExportAssignment: TSExportAssignmentBuilder;
  tsNamespaceExportDeclaration: TSNamespaceExportDeclarationBuilder;
  tsInterfaceBody: TSInterfaceBodyBuilder;
  tsInterfaceDeclaration: TSInterfaceDeclarationBuilder;
  tsParameterProperty: TSParameterPropertyBuilder;
  [builderName: string]: any;
}
