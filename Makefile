PIP := pip
PYTHON := python
YARN := jlpm

testjs: ## Make js tests
	cd js; ${YARN} test

testpy: ## Make py tests
	${PYTHON} -m pytest -v jupyterfs/tests --cov=jupyterfs --cov-branch --junitxml=python_junit.xml --cov-report=xml

testbrowser:
	cd js; ${YARN} test:browser

test: ## run all tests
	make testjs
	make testpy
	make testbrowser

lintjs: ## run linter
	cd js; ${YARN} lint

lintpy: ## run linter
	${PYTHON} -m flake8 jupyterfs setup.py

lint: ## run linter
	make lintjs
	make lintpy

fixjs:  ## run autopep8/tslint fix
	cd js; ${YARN} fix

fixpy:  ## run autopep8
	${PYTHON} -m autopep8 --in-place -r -a -a jupyterfs/ setup.py

fix:  ## run autopep8/tslint fix
	make fixjs
	make fixpy

clean: ## clean the repository
	## python tmp state
	find . -name "__pycache__" | xargs  rm -rf
	find . -name "*.pyc" | xargs rm -rf
	find . -name ".ipynb_checkpoints" | xargs  rm -rf
	## binder/repo2docker mess
	rm -rf binder/.[!.]* binder/*.ipynb
	## build state
	cd js; ${YARN} clean:slate
	rm -rf *.egg-info *junit.xml .*-log.txt .jupyter/ .local/ .pytest_cache/ build/ coverage* dist/ MANIFEST node_modules/ pip-wheel-metadata jupyterfs/labextension
	# make -C ./docs clean
	## package lock files
	# rm -rf package-lock.json yarn-lock.json js/package-lock.json js/yarn-lock.json

dev_install: dev_serverextension dev_labextension ## set up the repo for active development
	# verify
	${PYTHON} -m jupyter serverextension list
	${PYTHON} -m jupyter server extension list
	${PYTHON} -m jupyter labextension list

dev_labextension:  ## build and install labextension for active development
	${PYTHON} -m jupyter labextension develop --overwrite .

dev_serverextension:  ## install and enable serverextension for active development
	${PIP} install -e .[dev]
	${PYTHON} -m jupyter server extension enable --py jupyterfs.extension

docs:  ## make documentation
	make -C ./docs html
	open ./docs/_build/html/index.html

install:  ## do standard install of both server/labextension to site-packages
	${PIP} install .

js:  ## build javascript
	cd js; ${YARN} integrity
	cd js; ${YARN} build

dist: clean ## create dists
	${PYTHON} setup.py sdist bdist_wheel

publish: dist  ## dist to pypi and npm
	twine check dist/* && twine upload dist/*
	cd js; npm publish

publishdry: dist  ## dry-run dist to pypi and npm
	twine check dist/*
	cd js; npm publish --dry-run

publishtest: dist  ## release to test pypi, dry-run npm publish
	twine check dist/* && twine upload --repository-url https://test.pypi.org/legacy/ dist/*
	cd js; npm publish --dry-run


# Thanks to Francoise at marmelab.com for this
.DEFAULT_GOAL := help
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

print-%:
	@echo '$*=$($*)'

.PHONY: clean dev_install dev_labextension dev_serverextension dist docs help install js test tests
