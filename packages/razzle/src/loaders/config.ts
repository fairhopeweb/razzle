import fs from "fs";


import setupEnvironment from "../env.js";
import logger from "../logger.js";
import defaultPaths from "../paths.js";
import { Plugin, Config, Context, Options } from "../types.js";

import loadPlugins from "./plugins.js";

export default (
  razzleConfigIn?: Config | undefined,
  packageJsonIn?: unknown | undefined
): Promise<{ razzleConfig: Config; razzleContext: Context }> =>
  new Promise(async (resolve) => {
    let razzleConfig: Config = razzleConfigIn || { plugins: [] };
    let packageJson = packageJsonIn || {};
    // Check for razzle.config.js file
    if (fs.existsSync(defaultPaths.appConfig + ".js")) {
      try {
        razzleConfig = (await import(defaultPaths.appConfig + ".js"))
          .default;
      } catch (e) {
        logger.error("Invalid razzle.config.js file.", e);

        process.exit(1);
      }
    }
    if (fs.existsSync(defaultPaths.appPackageJson)) {
      try {
        packageJson = JSON.parse(
          fs.readFileSync(defaultPaths.appPackageJson).toString()
        );
      } catch (e) {
        logger.error("Invalid package.json.", e);
        process.exit(1);
      }
    }

    setupEnvironment(defaultPaths);

    const razzleOptions: Options = Object.assign(
      <Options>{ verbose: false, debug: false },
      razzleConfig.options || {}
    );

    let razzleContext: Context = {
      paths: defaultPaths,
      razzleOptions: razzleOptions,
      plugins: await loadPlugins(
        defaultPaths.ownNodeModules,
        razzleConfig.plugins
      ),
    };

    for (const { plugin, options: pluginOptions } of razzleContext.plugins) {
      // Check if plugin.modifyContext is a function.
      // If it is, call it on the context we created.
      if ((<Plugin>plugin).modifyContext) {
        razzleContext = await (<Required<Plugin>>(
          plugin
        )).modifyContext(pluginOptions, razzleContext);
      }
    }
    if (razzleConfig.modifyContext) {
      // Check if razzle.modifyContext is a function.
      // If it is, call it on the paths we created.
      razzleContext = await razzleConfig.modifyContext(razzleContext);
    }

    resolve({
      razzleConfig,
      razzleContext,
    });
  });
