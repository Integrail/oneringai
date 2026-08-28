import { SyntaxKind, type Node } from 'ts-morph';

type DeclarationWithBody = Node & { getBody?: () => Node | undefined };
type DeclarationWithModifiers = Node & { getModifiers?: () => Node[] };

/** Return a declaration through (but not including) its implementation body. */
export function getDeclarationSignature(node: Node): string {
  const declaration = node as DeclarationWithBody;
  const body = declaration.getBody?.();
  if (!body) return node.getText().trim();

  const source = node.getSourceFile().getFullText();
  return source.slice(node.getStart(), body.getStart()).trim();
}

/** Whether a declaration is explicitly marked private. */
export function hasPrivateModifier(node: Node): boolean {
  const declaration = node as DeclarationWithModifiers;
  return declaration.getModifiers?.().some(
    (modifier) => modifier.getKind() === SyntaxKind.PrivateKeyword,
  ) ?? false;
}
