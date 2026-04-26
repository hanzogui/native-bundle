import { build } from "vite";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
async function bundleNative(options) {
  const {
    entry,
    outDir = "dist",
    fileName = "native.cjs",
    cwd = process.cwd(),
    define = {},
    minify = false,
    isTest = false
  } = options;
  const resolvePath = (name) => {
    try {
      return fileURLToPath(import.meta.resolve(name));
    } catch {
      return name;
    }
  };
  const resolvePackageDir = (name) => {
    try {
      const pkgJson = fileURLToPath(import.meta.resolve(`${name}/package.json`));
      return dirname(pkgJson);
    } catch {
      return name;
    }
  };
  const rnwl = resolvePath("@hanzogui/react-native-web-lite");
  const rnwlDir = resolvePackageDir("@hanzogui/react-native-web-lite");
  const fakeRN = resolvePath("@hanzogui/fake-react-native");
  const entryPath = resolve(cwd, entry);
  const defaultDefine = {
    "process.env.GUI_TARGET": JSON.stringify("native"),
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.env.GUI_IS_CORE_NODE": JSON.stringify("1")
  };
  const external = isTest ? [/^react($|\/)/, /^react-native($|\/)/] : [
    /^react($|\/)/,
    /^react-native-reanimated($|\/)/,
    /^react-native-worklets($|\/)/,
    // Reanimated's internal code requires react-native/Libraries/Renderer/shims/ReactFabric
    // which doesn't exist in the web bundle. Externalize it so the bundler doesn't try to resolve it.
    /react-native\/Libraries\//
  ];
  const alias = isTest ? [
    // Aliases don't work for pre-bundled deps, so we externalize and alias in vitest config
  ] : [
    {
      find: /^react-native$/,
      replacement: rnwl
    },
    {
      find: /^react-native\/(.+)$/,
      replacement: `${rnwlDir}/src/$1`
    }
  ];
  await build({
    configFile: false,
    root: cwd,
    build: {
      lib: {
        entry: entryPath,
        name: "GuiNativeBundle",
        fileName: () => fileName,
        formats: ["cjs"]
      },
      outDir,
      emptyOutDir: false,
      rollupOptions: {
        external,
        output: {
          // Ensure CommonJS output
          format: "cjs",
          exports: "named"
        }
      },
      target: "es2015",
      minify
    },
    resolve: {
      // Prefer react-native exports
      mainFields: ["react-native", "module", "main"],
      extensions: [
        ".native.ts",
        ".native.tsx",
        ".native.js",
        ".ts",
        ".tsx",
        ".js",
        ".jsx"
      ],
      conditions: ["react-native", "import", "module", "default"],
      alias
    },
    define: {
      ...defaultDefine,
      ...define
    },
    logLevel: "warn"
  });
}
async function runCLI() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: native-bundle <entry-file> [output-file]");
    process.exit(1);
  }
  const entry = args[0];
  const fileName = args[1] || "native.cjs";
  console.log(`Bundling ${entry} -> dist/${fileName}`);
  try {
    await bundleNative({ entry, fileName });
    console.log("\u2713 Bundle created successfully");
  } catch (error) {
    console.error("\u2717 Bundle failed:", error);
    process.exit(1);
  }
}
export {
  bundleNative,
  runCLI
};
