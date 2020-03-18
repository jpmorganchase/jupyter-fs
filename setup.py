# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#
from codecs import open
from os import path
from pathlib import Path
from setuptools import setup, find_packages
from setuptools.command.develop import develop
from subprocess import CalledProcessError

from jupyter_packaging import (
    combine_commands, command_for_func, create_cmdclass, ensure_python,
    ensure_targets, get_version, run
)

ensure_python(('2.7', '>=3.3'))

name = 'jupyter-fs'
here = path.abspath(path.dirname(__file__))
version = get_version(path.join(here, "jupyterfs", '_version.py'))

with open(path.join(here, 'README.md'), encoding='utf-8') as f:
    long_description = f.read()

requires = [
    'fs>=2.4.11',
    'jupyterlab>=2.0.0',
    'notebook>=5.7.0',
]

dev_requires = requires + [
    'autopep8',
    'bump2version',
    'codecov',
    'flake8',
    'mock',
    'pylint',
    'pytest',
    'pytest-cov',
]

data_files_spec = [
    # Lab extension installed by default:
    ('share/jupyter/lab/extensions',
     'lab-dist',
     'jupyter-fs-*.tgz'),
    # Config to enable server extension by default:
    ('etc/jupyter',
     'jupyter-config',
     '**/*.json'),
]

def runPackLabextension():
    if Path('package.json').is_file():
        try:
            run(['jlpm', 'build:all'])
        except CalledProcessError:
            pass
pack_labext = command_for_func(runPackLabextension)

class DevelopAndEnable(develop):
    def run(self):
        develop.run(self)

        list_cmd = [
            'jupyter',
            'serverextension',
            'list'
        ]
        enable_cmd = [
            'jupyter',
            'serverextension',
            'enable',
            '--py',
            'jupyterfs'
        ]

        # TODO: fix this
        # Currently, if pyproject.toml is present the
        # `serverextension enable` command fails with
        # ```
        #     m, server_exts = _get_server_extension_metadata(package)
        #   File ".../site-packages/notebook/serverextensions.py", line 328, in _get_server_extension_metadata
        #     m = import_item(module)
        #   File ".../site-packages/traitlets/utils/importstring.py", line 42, in import_item
        #     return __import__(parts[0])
        # ModuleNotFoundError: No module named 'jupyterfs'
        # ```

        # # test if `jupyter` cmd is available
        # try:
        #     run(list_cmd)
        # except:
        #     print('`jupyter` cmd not installed, skipping serverextension activation...')
        #     return

        # print('Enabling serverextension...')
        # run(enable_cmd)

cmdclass = create_cmdclass('pack_labext', data_files_spec=data_files_spec)
cmdclass['pack_labext'] = combine_commands(
    command_for_func(runPackLabextension),
    ensure_targets([
        path.join(here, 'lib', 'index.js'),
        path.join(here, 'style', 'index.css')
    ]),
)
cmdclass['develop'] = DevelopAndEnable

setup(
    name=name,
    version=version,
    description='A Filesystem-like mult-contents manager backend for Jupyter',
    long_description=long_description,
    long_description_content_type='text/markdown',
    url='https://github.com/timkpaine/jupyter-fs',
    author='Tim Paine',
    author_email='t.paine154@gmail.com',
    license='Apache 2.0',
    classifiers=[
        'Development Status :: 3 - Alpha',
        'Programming Language :: Python :: 2',
        'Programming Language :: Python :: 2.7',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.6',
        'Programming Language :: Python :: 3.7',
        'Programming Language :: Python :: 3.8',
        'Framework :: Jupyter',
    ],
    cmdclass=cmdclass,
    keywords='jupyter jupyterlab',
    packages=find_packages(exclude=['tests', ]),
    install_requires=requires,
    extras_require={
        'dev': dev_requires
    },
    include_package_data=True,
    zip_safe=False
)
