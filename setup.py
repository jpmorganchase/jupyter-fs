# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.

from codecs import open
from pathlib import Path

from jupyter_packaging import (
    combine_commands,
    create_cmdclass,
    ensure_python,
    ensure_targets,
    get_version,
    install_npm,
)
from setuptools import find_packages, setup

# the name of the project
name = 'jupyter-fs'

# the Path to the python pkg dir
py_pkg = Path('jupyterfs')

# the Path to the javascript pkg dir
js_pkg = Path('js')

ensure_python(('2.7', '>=3.6'))

version = get_version(str(py_pkg / '_version.py'))

with open('README.md', encoding='utf-8') as f:
    long_description = f.read()

data_files_spec = [
    # lab extension installed by default:
    ('share/jupyter/lab/extensions', str(py_pkg / 'labdist'), '*.tgz'),
    # config to enable server extension by default:
    ("etc/jupyter/jupyter_server_config.d", "jupyter-config", "jupyterfs.json"),
]

cmdclass = create_cmdclass('jsdeps', data_files_spec=data_files_spec)
cmdclass['jsdeps'] = combine_commands(
    install_npm(js_pkg, build_cmd='build:labdist', npm=['jlpm']),
    ensure_targets([js_pkg / 'lib' / 'index.js', js_pkg / 'style' / 'index.css']),
)

cmdclass.pop("develop")

requires = [
    'fs>=2.4.11',
    'fs-s3fs>=1.1.1',
    'fs.smbfs>=0.6.3',
    'jupyterlab>=3.0.0',
    'jupyter_server>=1.6.0',
]

test_requires = [
    'boto3',
    'docker',
    'fs-miniofs',
    'mock',
    'pysmb',
    'pytest',
    'pytest-cov',
]

dev_requires = test_requires + [
    'autopep8>=1.5',
    'bump2version>=1.0.0',
    'flake8>=3.7.8',
    'mock',
    'pytest',
    'pytest-cov>=2.6.1',
    'pytest-xdist',
    'Sphinx>=1.8.4',
    'sphinx-markdown-builder>=0.5.2',
]


setup(
    name=name,
    version=version,
    description='A Filesystem-like mult-contents manager backend for Jupyter',
    long_description=long_description,
    long_description_content_type='text/markdown',
    url='https://github.com/jpmorganchase/jupyter-fs',
    author='jupyter-fs authors',
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
    packages=find_packages(exclude=('js', 'js.*')),
    install_requires=requires,
    extras_require={'dev': dev_requires},
    include_package_data=True,
    zip_safe=False,
)
