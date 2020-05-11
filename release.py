#!/usr/bin/env python

description = """if run with no args, this script will:
1. deterime the true project version from jupyterfs/_version.py
2. "version"
    - force the version in package.json to agree
3. "tag"
    - create a git version tag
    - push said tag upstream
4. "pypi"
    - build/bundle the labextension together with the python package
    - do the pypi release
5. "npmjs"
    - build the labextension
    - do the npmjs release
"""

import argparse as argpar
import json
import subprocess

from setupbase import get_version

VERSION_PY = 'jupyterfs/_version.py'

def prepLabextensionBundle():
    subprocess.run(['jlpm', 'install'])
    subprocess.run(['jlpm', 'clean:slate'])

def tag(version, dry_run=False, kind=None):
    """git tagging
    """
    kw = {'version': version, 'kind': kind}
    tag = '{kind}_v{version}'.format(**kw) if kind else 'v{version}'.format(**kw)

    if dry_run:
        print("Would tag: {}".format(tag))
    else:
        subprocess.run(['git', 'tag', tag])
        subprocess.run(['git', 'push', 'upstream', tag])

def pypi(wheel=True, dry_run=False):
    """release on pypi
    """
    if wheel:
        # build the source (sdist) and binary wheel (bdist_wheel) releases
        subprocess.run(['python', 'setup.py', 'sdist', 'bdist_wheel'])
    else:
        # build just the source release
        subprocess.run(['python', 'setup.py', 'sdist'])

    if dry_run:
        # check the dist
        subprocess.run(['twine', 'check', 'dist/*'])
    else:
        # release to the production pypi server
        subprocess.run(['twine', 'upload', 'dist/*'])

def npmjs(dry_run=False):
    """release on npmjs
    """
    if dry_run:
        # dry run build and release
        subprocess.run(['npm', 'publish', '--access', 'public', '--dry-run'])
    else:
        # build and release
        subprocess.run(['npm', 'publish', '--access', 'public'])

def labExtensionVersion(dry_run=False, version=None):
    if version:
        if 'rc' in version:
            version,rc = version.split('rc')
            version = version + '-rc.{}'.format(rc)

        force_ver_cmd = ['npm', '--no-git-tag-version', 'version', version, '--force', '--allow-same-version']
        force_ver_info = ' '.join(force_ver_cmd)

        if dry_run:
            print("Would force npm version with: {}".format(force_ver_info))
        else:
            # force the labextension version to match the supplied version
            print("> {}".format(force_ver_info))
            subprocess.run(force_ver_cmd)
    else:
        # get single source of truth from the Typescript labextension
        with open('package.json') as f:
            info = json.load(f)

        version = info['version']

    return version

def serverExtensionVersion():
    # get single source of truth from the Python serverextension
    return get_version(VERSION_PY)

def doRelease(actions, dry_run=False):
    # treat the serverextension version as the "real" single source of truth
    version = serverExtensionVersion()

    if 'version' in actions:
        # force the labextension version to agree with the serverextension version
        labExtensionVersion(version=version)

    if 'tag' in actions:
        # tag with version and push the tag
        tag(dry_run=dry_run, version=version)

    if 'pypi' in actions or 'npmjs' in actions:
        # prep the build area for the labextension bundle
        prepLabextensionBundle()

    if 'pypi' in actions:
        # release to pypi
        pypi(dry_run=dry_run)

    if 'npmjs' in actions:
        if 'pypi' not in actions:
            # ensure ts build is up to date
            subprocess.run(['jlpm', 'build:integrity'])

        # release to npmjs
        npmjs(dry_run=dry_run)

def main():
    parser = argpar.ArgumentParser(description=description)

    parser.add_argument('--dry-run',
        action='store_true',
        help='Performs a dry run of all release actions'
    )
    parser.add_argument('--actions',
        nargs='*',
        choices={'version', 'tag', 'pypi', 'npmjs'},
        default={'version', 'tag', 'pypi', 'npmjs'},
        help='optionally select a subset of the release actions to perform'
    )

    parsed = vars(parser.parse_args())
    actions = parsed['actions']
    dry_run = parsed['dry_run']

    doRelease(actions, dry_run=dry_run)

if __name__=='__main__':
    main()
