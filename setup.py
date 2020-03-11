# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#
from setuptools import setup, find_packages
from codecs import open
from os import path

from jupyter_packaging import (
    create_cmdclass, install_npm, ensure_targets,
    combine_commands, ensure_python, get_version
)

pjoin = path.join

ensure_python(('2.7', '>=3.3'))

name = 'jupyter-fs'
here = path.abspath(path.dirname(__file__))
version = get_version(pjoin(here, "jupyterfs", '_version.py'))

with open(path.join(here, 'README.md'), encoding='utf-8') as f:
    long_description = f.read()

requires = [
    'fs>=2.4.11',
    'jupyterlab>=1.0.0',
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

data_spec = [
    # Lab extension installed by default:
    ('share/jupyter/lab/extensions',
     'lab-dist',
     'multicontentsmanager-*.tgz'),
    # Config to enable server extension by default:
    ('etc/jupyter',
     'jupyter-config',
     '**/*.json'),
]


cmdclass = create_cmdclass('js', data_files_spec=data_spec)
cmdclass['js'] = combine_commands(
    install_npm(here, build_cmd='build:all'),
    ensure_targets([
        pjoin(here, 'lib', 'index.js'),
        pjoin(here, 'style', 'index.css')
    ]),
)


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
    zip_safe=False,

)
