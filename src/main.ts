import { ModuleNode, Plugin } from "vite";

export interface SvgXOptions {
  path: string[];
}

export function svgX(options: SvgXOptions): Plugin {
  return {
    name: "svg-x",
    transformIndexHtml(html) {
      console.log("transformIndexHtml");
      return html.replace(/<head>/,'<head> <meta></meta>')
    },
    handleHotUpdate({ file, server, modules, timestamp }) {
      console.log("handleHotUpdate", file, modules.length);
      if (
        (file.endsWith(".svg"),
        options.path.findIndex((i) => file.startsWith(i)) > -1)
      ) {
        server.hot.send({ type: "full-reload" });
      }
      // 手动使模块失效
      const invalidatedModules = new Set<ModuleNode>();
      for (const mod of modules) {
        console.log(mod.id);
        server.moduleGraph.invalidateModule(
          mod,
          invalidatedModules,
          timestamp,
          true
        );
      }
      return [];
    },
  };
}
