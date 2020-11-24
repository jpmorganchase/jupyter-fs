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

fixpy:  ## run autopep8/tslint fix
	${PYTHON} -m autopep8 --in-place -r -a -a jupyterfs/

fix:  ## run autopep8/tslint fix
	make fixjs
	make fixpy

annotate: ## MyPy type annotation check
	${PYTHON} -m mypy -s jupyterfs

annotate_l: ## MyPy type annotation check - count only
	${PYTHON} -m mypy -s jupyterfs | wc -l

clean: ## clean the repository
	find . -name "__pycache__" | xargs  rm -rf
	find . -name "*.pyc" | xargs rm -rf
	find . -name ".ipynb_checkpoints" | xargs  rm -rf
	rm -rf build coverage* dist *.egg-info *junit.xml .jupyter MANIFEST node_modules package-lock.json pip-wheel-metadata yarn.lock
	rm -rf js/dist js/lib js/node_modules js/package-lock.json js/tsconfig.tsbuildinfo js/yarn.lock
	rm -rf jupyterfs/labdist
	# make -C ./docs clean

dev_install: ## set up the repo for active development
	${PIP} install -e .[dev]
	${PYTHON} -m jupyter serverextension enable --py jupyterfs
	cd js; ${YARN} build:integrity
	cd js; ${PYTHON} -m jupyter labextension install .
	# verify
	${PYTHON} -m jupyter serverextension list
	${PYTHON} -m jupyter labextension list

docs:  ## make documentation
	make -C ./docs html
	open ./docs/_build/html/index.html

install:  ## install to site-packages
	${PIP} install .

serverextension: install ## enable serverextension
	${PYTHON} -m jupyter serverextension enable --py jupyterfs

js:  ## build javascript
	cd js; ${YARN} build:integrity

labextension: js ## enable labextension
	${PYTHON} -m jupyter labextension install .

dist: clean ## create dists
	cd js; ${YARN} install
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

.PHONY: clean dist docs help install js labextension serverextension test tests
