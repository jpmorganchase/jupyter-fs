# Contributing

Thank you for your interest in contributing to jupyter-fs!

We invite you to contribute enhancements. Upon review you will be required to complete the [Contributor License Agreement (CLA)](https://github.com/jpmorganchase/cla) before we are able to merge. 

If you have any questions about the contribution process, please feel free to send an email to [open_source@jpmorgan.com](mailto:open_source@jpmorgan.com).

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

