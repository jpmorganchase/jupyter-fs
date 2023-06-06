# Contributing

Thank you for your interest in contributing to jupyter-fs!

We invite you to contribute enhancements. Upon review you will be required to complete the [Contributor License Agreement (CLA)](https://github.com/jpmorganchase/cla) before we are able to merge.

If you have any questions about the contribution process, please feel free to send an email to [open_source@jpmorgan.com](mailto:open_source@jpmorgan.com).

## Setup for Development

### Install

Note: You will need NodeJS to build the extension package.

```bash
pip install -e .[dev]
```

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Change directory to the jupyter-fs directory
# Install package in development mode
jlpm
cd js
jlpm build
cd ..
jlpm develop
```

### Configure

You'll need to set the contents manager class in the jupyter server config. Paste the following json into your config:

```json
{
  "ServerApp": {
    "contents_manager_class": "jupyterfs.metamanager.MetaManager"
  }
}
```

or run lab with

```bash
jupyter lab --ServerApp.contents_manager_class="jupyterfs.metamanager.MetaManager"
```

into a file named `${CONFIG}/jupyter_server_config.json`, where `CONFIG` is any of the config paths returned by the `jupyter --paths` command.

### Rebuild after you make changes

After you make a change to the Typescript sources, you can rebuild jupyter-fs once by running the following:

```bash
# Rebuild extension Typescript source after making changes
(cd js; jlpm run build)
```

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
(cd js; jlpm run watch)
# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

### Sourcemaps

By default, the `jlpm run build` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```

## Do a Release

1. Have access to `jupyter-fs` on pypi and npmjs

2. Checkout new release branch

    ```bash
    git checkout -b release-v<major>.<minor>.<patch>
    ```

3. Bump version

    ```bash
    # example: bump2version patch --allow-dirty --new-version "0.0.6final0"
    bump2version patch --allow-dirty --new-version "<major>.<minor>.<patch>final0"
    ```

4. Do release

    ```bash
    # dry run
    # make publishdry

    make publish
    ```

5. Push release branch to upstream

    ```bash
    git push -u upstream release-v<major>.<minor>.<patch> --tags
    ```

6. Open a PR for the release branch on https://github.com/jpmorganchase/jupyter-fs

## Guidelines

When submitting PRs to jupyter-fs, please respect the following general
coding guidelines:

* Please try to keep PRs small and focused.  If you find your PR touches multiple loosely related changes, it may be best to break up into multiple PRs.
* Individual commits should preferably do one thing, and have descriptive commit messages.  Do not make "WIP" or other mystery commit messages.
* ... that being said, one-liners or other commits should typically be grouped.  Please try to keep 'cleanup', 'formatting' or other non-functional changes to a single commit at most in your PR.
* PRs that involve moving files around the repository tree should be organized in a stand-alone commit from actual code changes.
* Please do not submit incomplete PRs or partially implemented features.
* Please do not submit PRs disabled by feature or build flag - experimental features should be kept on a branch until they are ready to be merged.
* All PRs should be accompanied by tests asserting their behavior in any packages they modify.
* Do not commit with `--no-verify` or otherwise bypass commit hooks, and please respect the formatting and linting guidelines they enforce.
* Do not `merge master` upstream changes into your PR.  If your change has conflicts with the `master` branch, please pull master into your fork's master, then rebase.

