import { ModuleNode, Plugin } from "vite";
import SvgSprite from "svg-sprite";
import fs from "fs";
import path from "path";
import File from "vinyl";
import { optimize, Config } from "svgo";

export interface SvgXOptions {
  path: string[];
  svgoConfig?: Config;
}

export function svgX(options: SvgXOptions): Plugin {
  return {
    name: "svg-x",
    configureServer(server) {
      server.watcher.add(options.path);
      server.watcher.on("add", (path) => {
        if (path.endsWith(".svg")) {
          server.hot.send({ type: "full-reload" });
        }
      });
    },
    async transformIndexHtml(html) {
      let sprite = new SvgSprite({
        dest: "dist",
        mode: {
          symbol: true,
        },
        svg: {
          xmlDeclaration: false,
          doctypeDeclaration: false,
          rootAttributes: {
            style: "position:absolute;width:0px;height:0px;overflow:hidden;",
          },
        },
      });
      options.path.forEach((svgDirPath) => {
        // 遍历子文件夹，查找其中的svg
        let files = fs.readdirSync(svgDirPath);
        while (files.length > 0) {
          const file = files.shift()!;
          let fullFilePath = path.join(svgDirPath, file);
          // 判断是不是目录
          const isDirectory = fs.lstatSync(fullFilePath).isDirectory();
          if (isDirectory) {
            let subPaths = fs
              .readdirSync(fullFilePath)
              .map((item) => path.join(file, item));
            files.push(...subPaths);
            continue;
          }
          if (!fullFilePath.endsWith(".svg")) {
            continue;
          }
          let svgString = fs.readFileSync(fullFilePath, "utf-8");
          let svgoConfig: Config = {
            path: fullFilePath,
            multipass: true,
            plugins: [
              {
                name: "convertStyleToAttrs",
                params: {
                  keepImportant: false,
                },
              },
              {
                name: "fill-colors",
                fn: () => {
                  return {
                    element: {
                      enter: (node) => {
                        if (
                          node.attributes.fill &&
                          !node.attributes.fill.startsWith("var(")
                        ) {
                          node.attributes.fill = `var(--svg-fill,${node.attributes.fill})`;
                        }
                        if (!node.attributes.fill) {
                          node.attributes.fill = `var(--svg-fill)`;
                        }
                        if (
                          node.attributes.stroke &&
                          !node.attributes.stroke.startsWith("var(")
                        ) {
                          node.attributes.stroke = `var(--svg-stroke,${node.attributes.stroke})`;
                        }
                        if (!node.attributes.stroke) {
                          node.attributes.stroke = `var(--svg-stroke)`;
                        }
                      },
                    },
                  };
                },
              },
            ],
          };
          if (options.svgoConfig) {
            svgoConfig = Object.assign(svgoConfig, options.svgoConfig);
          }
          const result = optimize(svgString, svgoConfig);
          const optimizedSvgString = result.data;
          sprite.add(path.join(svgDirPath, file), file, optimizedSvgString);
        }
      });
      let spriteStr = "";
      sprite.compile((error, result, data) => {
        // 读取 File 对象的内容转为字符串
        spriteStr = (result.symbol.sprite as File).contents?.toString() ?? "";
      });
      return html.replace("<body>", `<body>${spriteStr}`);
    },
    handleHotUpdate({ file, server, modules, timestamp }) {
      if (
        (file.endsWith(".svg"),
        options.path.findIndex((i) => file.startsWith(i)) > -1)
      ) {
        server.hot.send({ type: "full-reload" });
      }
      // 手动使模块失效
      const invalidatedModules = new Set<ModuleNode>();
      for (const mod of modules) {
        server.moduleGraph.invalidateModule(
          mod,
          invalidatedModules,
          timestamp,
          true
        );
      }
      return modules;
    },
  };
}
