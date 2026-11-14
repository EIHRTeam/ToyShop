import { parse } from 'acorn';

const unsupportedMethods = new Set(['at', 'toSorted', 'toSpliced']);

function propertyName(member) {
  if (member?.type !== 'MemberExpression') return undefined;
  return member.computed ? staticString(member.property) : member.property.name;
}

function isNamed(node, name) {
  return node?.type === 'Identifier' && node.name === name;
}

function isArrayPrototype(node) {
  return (
    node?.type === 'MemberExpression' &&
    isNamed(node.object, 'Array') &&
    propertyName(node) === 'prototype'
  );
}

function staticString(node) {
  if (node?.type === 'Literal') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0)
    return node.quasis[0].value.cooked;
}

function isUnsupportedGlobal(member) {
  return isNamed(member.object, 'Object') && propertyName(member) === 'hasOwn';
}

function isOrderedDict(node) {
  if (
    !['ClassDeclaration', 'ClassExpression'].includes(node.type) ||
    !isNamed(node.superClass, 'Map')
  )
    return false;
  const methods = new Set(
    node.body.body.map((method) => staticString(method.key) ?? method.key?.name),
  );
  return ['at', 'keyAt', 'toSorted', 'toSpliced'].every((name) => methods.has(name));
}

function visit(node, callback, parents = []) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) visit(child, callback, parents);
    return;
  }
  if (typeof node.type !== 'string') return;
  callback(node, parents);
  parents.push(node);
  for (const child of Object.values(node)) visit(child, callback, parents);
  parents.pop();
}

function isOrderedDictAt(call, parents) {
  // Radix OrderedDict.from() calls its own at() method, which has a Chrome 88 fallback.
  if (call.callee.object.type !== 'ThisExpression') return false;
  const method = [...parents].reverse().find((node) => node.type === 'MethodDefinition');
  const owner = [...parents].reverse().find((node) => isOrderedDict(node));
  return method?.key?.name === 'from' && Boolean(owner);
}

function isOrderedDictSort(call, parents, hasOrderedDict) {
  // Radix's state updater sorts an OrderedDict and compares its custom keyAt() order.
  // Other receiver calls, including ordinary arrays, remain audit failures.
  if (!hasOrderedDict || call.callee.object.type !== 'Identifier') return false;
  const receiver = call.callee.object.name;
  const declarator = parents.at(-1);
  if (declarator?.type !== 'VariableDeclarator' || declarator.init !== call) return false;
  const sorted = declarator.id;
  if (sorted.type !== 'Identifier') return false;
  const body = [...parents].reverse().find((node) => node.type === 'BlockStatement');
  if (!body || body.body.length !== 2 || body.body[0].type !== 'VariableDeclaration') return false;
  const result = body.body[1];
  if (result.type !== 'ReturnStatement' || result.argument?.type !== 'ConditionalExpression')
    return false;
  const { test, consequent, alternate } = result.argument;
  if (!isNamed(consequent, sorted.name) || !isNamed(alternate, receiver)) return false;
  if (test.type !== 'CallExpression' || propertyName(test.callee) !== 'some') return false;
  if (!isNamed(test.callee.object, sorted.name)) return false;
  let usesKeyAt = false;
  visit(test, (node) => {
    if (node.type === 'CallExpression' && propertyName(node.callee) === 'keyAt')
      usesKeyAt ||= isNamed(node.callee.object, receiver);
  });
  return usesKeyAt;
}

function isGuardedArrayAt(call, parents) {
  return parents.some(
    (node) =>
      node.type === 'IfStatement' &&
      node.test.type === 'BinaryExpression' &&
      node.test.operator === 'in' &&
      staticString(node.test.left) === 'at' &&
      isArrayPrototype(node.test.right) &&
      call.start >= node.consequent.start &&
      call.end <= node.consequent.end,
  );
}

export function findUnsupportedWebApi(source) {
  const ast = parse(source, { ecmaVersion: 2022, sourceType: 'script' });
  let hasOrderedDict = false;
  visit(ast, (node) => {
    hasOrderedDict ||= isOrderedDict(node);
  });
  let issue;
  visit(ast, (node, parents) => {
    if (issue || node.type !== 'CallExpression') return;
    const callee = node.callee;
    if (callee.type !== 'MemberExpression') return;
    let member = callee;
    const invocation = propertyName(callee);
    if (
      (invocation === 'call' || invocation === 'apply') &&
      callee.object.type === 'MemberExpression'
    )
      member = callee.object;
    const name = propertyName(member);
    if (!isUnsupportedGlobal(member) && !unsupportedMethods.has(name)) return;
    if (member === callee && name === 'at' && isOrderedDictAt(node, parents)) return;
    if (
      member === callee &&
      name === 'toSorted' &&
      isOrderedDictSort(node, parents, hasOrderedDict)
    )
      return;
    if (
      member !== callee &&
      name === 'at' &&
      isArrayPrototype(member.object) &&
      isGuardedArrayAt(node, parents)
    )
      return;
    issue = `${source.slice(node.start, Math.min(node.end, node.start + 80))} at offset ${node.start}`;
  });
  return issue;
}
