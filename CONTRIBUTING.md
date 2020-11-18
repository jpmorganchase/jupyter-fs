# Contributing

Thank you for your interest in contributing to jupyter-fs!

We invite you to contribute enhancements. Upon review you will be required to complete the [Contributor License Agreement (CLA)](https://github.com/jpmorganchase/cla) before we are able to merge.

If you have any questions about the contribution process, please feel free to send an email to [open_source@jpmorgan.com](mailto:open_source@jpmorgan.com).

## Install for Development

- To get everything set up initially, you `cd` to your jupyter-fs repo and then just do:

    ```bash
    make dev_install
    ```

- If, for whatever reason, you need to reinstall the Python package, do:

    ```bash
    pip install -e .
    ```

- When you're actively developing the Typescript sources, you can do a rebuild with:

    ```bash
    jlpm build
    ```

    Alternatively, you can do a watch build, which automatically rebuilds your code when you make changes to jupyter-fs:

    ```bash
    jlpm build:watch
    ```

    If you then also run JupyterLab in watch mode:

    ```bash
    jupyter lab --watch
    ```

    you can make edits to the typescript sources and then see the effect of your changes by refreshing JupyterLab's browser window.

## Do a Release

1. Have access to `jupyter-fs` on pypi and npmjs

2. Checkout new release branch

    ```bash
    git checkout -b release-v<major>.<minor>.<patch>
    ```

3. Bump version

    ```bash
    # example: bump2version patch --new-version "0, 0, 5, 'final', 0"
    bump2version patch --new-version "<major>, <minor>, <patch>, 'final', 0"
    ```

4. Do release

    ```bash
    make publish
    ```

5. Tag and push

    ```bash
    git tag v<major>.<minor>.<patch>
    git push upstream v<major>.<minor>.<patch>
    ```

6. Push release branch to your fork

    ```bash
    git push -u origin release-v<major>.<minor>.<patch>
    ```

7. Open a PR for the release branch on https://github.com/jpmorganchase/jupyter-fs

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

