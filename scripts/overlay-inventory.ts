import {readFileSync} from 'node:fs';
import {relative, resolve} from 'node:path';
import ts from 'typescript';
import type {Plugin} from 'vite';
import type {OverlayInventoryEntry} from '../src/lib/overlayInventory';

const moduleName = 'virtual:overlay-inventory';
const internalName = '\0' + moduleName;
const sourcePattern = /[/\\]src[/\\](?:pages|components)[/\\].*\.tsx$/;

function kindFor(component: string): OverlayInventoryEntry['kind'] | undefined {
  if (component.endsWith('Drawer')) return 'drawer';
  if (component.endsWith('Sheet') || component === 'ChatTargetPicker') return 'sheet';
  if (/(?:Dialog|Modal)$/.test(component) || ['SelectControl', 'SettingSelect', 'GestureLockOverlay'].includes(component)) return 'modal';
  if (component.endsWith('Lightbox') || component === 'MediaDrawer') return 'media';
  if (/(?:Popover|Tooltip|HeadingMenu|ContextMenu)$/.test(component)) return 'popover';
  if (['Snackbar', 'InlineAlert', 'FeedbackState', 'Tour', 'AppToast'].includes(component)) return 'feedback';
  if (['ExternalAppAction', 'ExternalAppIdentity', 'OverlayIconButton', 'DrawerDismissButton', 'PageTabs', 'TabPageHeader', 'SettingRow', 'SettingDialogRow', 'SettingSwitch', 'VerificationCodeInput'].includes(component)) return 'controls';
  return undefined;
}

function audiencesFor(source: string): OverlayInventoryEntry['audiences'] {
  if (/\/OAuthApplicationWorkspace/.test(source)) return ['member', 'platform'];
  if (/\/Management/.test(source)) return ['space', 'platform'];
  if (/\/(?:Platform|ResourceWorkspace)/.test(source)) return ['platform'];
  if (/\/(?:SpaceAdmin|AdminSpace|Admin[A-Z])/.test(source)) return ['space'];
  return ['member'];
}

function scan(root: string) {
  const results: OverlayInventoryEntry[] = [];
  for (const file of ts.sys.readDirectory(resolve(root, 'src'), ['.tsx'], ['**/node_modules/**'])) {
    if (!sourcePattern.test(file)) continue;
    const source = relative(root, file).replaceAll('\\', '/');
    if (/(?:LabPage|InteractionPatternsPage|ComponentAtlasPage)\.tsx$/.test(source)) continue;
    const code = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const owner = source.split('/').at(-1)!.replace(/\.tsx$/, '');
    const visit = (node: ts.Node) => {
      if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
        const tag = node.tagName.getText(code);
        const attr = (name: string) => node.attributes.properties.find((prop): prop is ts.JsxAttribute =>
          ts.isJsxAttribute(prop) && prop.name.getText(code) === name);
        const value = (name: string) => {
          const init = attr(name)?.initializer;
          return init && (ts.isStringLiteral(init) ? init : ts.isJsxExpression(init) ? init.expression : undefined);
        };
        const literal = (name: string) => {
          const expression = value(name);
          return expression && ts.isStringLiteralLike(expression) ? expression.text : undefined;
        };
        const flag = (name: string) => Boolean(attr(name) && value(name)?.kind !== ts.SyntaxKind.FalseKeyword);
        const role = attr('role')?.getText(code) ?? '';
        const directKind = tag === 'dialog' || /['"](?:alert)?dialog['"]/.test(role) ? 'modal'
          : /['"](?:menu|tooltip)['"]/.test(role) ? 'popover' : undefined;
        const custom = /^[A-Z]/.test(tag) ? kindFor(tag) : undefined;
        const kind = custom ?? (kindFor(owner) ? undefined : directKind);
        if (kind) {
          const heading = value('title') ?? value('label') ?? value('aria-label');
          const titleKey = heading?.getText(code).match(/\bt\(["']([\w.-]+)["']/)?.[1];
          const title = literal('title') ?? literal('label') ?? literal('aria-label');
          const line = code.getLineAndCharacterOfPosition(node.getStart(code)).line + 1;
          results.push({
            id: `${source}:${node.getStart(code)}`,
            audiences: audiencesFor(source),
            kind,
            component: custom ? tag : owner,
            source: `${source}:${line}`,
            title,
            titleKey,
            historyKey: literal('historyKey'),
            headerless: flag('headerless'),
            contentUnderToolbar: flag('contentUnderToolbar'),
            showTitle: flag('showTitle'),
            fullscreen: flag('fullscreen') || flag('fullViewport'),
            danger: flag('danger') || tag === 'AlertDialog' || literal('role') === 'alertdialog',
            tone: literal('tone'),
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(code);
  }
  return results;
}

export function overlayInventoryPlugin(): Plugin {
  return {
    name: 'overlay-inventory',
    resolveId(id) { if (id === moduleName) return internalName; },
    load(id) {
      if (id !== internalName) return;
      return `export default ${JSON.stringify(scan(process.cwd()))};`;
    },
    handleHotUpdate({file, server}) {
      if (!sourcePattern.test(file)) return;
      const module = server.moduleGraph.getModuleById(internalName);
      if (module) server.moduleGraph.invalidateModule(module);
    },
  };
}
