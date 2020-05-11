testjs: ## Clean and Make js tests
	yarn test

testpy: ## Clean and Make py tests
	python3.7 -m pytest -v jupyterfs/tests --cov=jupyterfs --cov-branch --junitxml=python_junit.xml --cov-report=xml

testbrowser:
	yarn test:browsercheck

test: ## run all tests
	make testjs
	make testpy
	make testbrowser

lintjs: ## run linter
	./node_modules/.bin/tslint src/* src/*/*

lintpy: ## run linter
	python3.7 -m flake8 jupyterfs setup.py

lint: ## run linter
	make lintjs
	make lintpy

fixjs:  ## run autopep8/tslint fix
	./node_modules/.bin/tslint --fix src/* src/*/*

fixpy:  ## run autopep8/tslint fix
	python3.7 -m autopep8 --in-place -r -a -a jupyterfs/

fix:  ## run autopep8/tslint fix
	make fixjs
	make fixpy

annotate: ## MyPy type annotation check
	python3.7 -m mypy -s jupyterfs

annotate_l: ## MyPy type annotation check - count only
	python3.7 -m mypy -s jupyterfs | wc -l

clean: ## clean the repository
	find . -name "__pycache__" | xargs  rm -rf
	find . -name "*.pyc" | xargs rm -rf
	find . -name ".ipynb_checkpoints" | xargs  rm -rf
	rm -rf .coverage coverage cover htmlcov logs build dist *.egg-info lib node_modules
	# make -C ./docs clean

dev_install: ## set up the repo for active development
	python3.7 -m pip install -e .[dev]
	python3.7 -m jupyter serverextension enable --py jupyterfs
	jlpm build:integrity
	python3.7 -m jupyter labextension link .
	# verify
	python3.7 -m jupyter serverextension list
	python3.7 -m jupyter labextension list

docs:  ## make documentation
	make -C ./docs html
	open ./docs/_build/html/index.html

install:  ## install to site-packages
	python3.7 -m pip install .

serverextension: install ## enable serverextension
	python3.7 -m jupyter serverextension enable --py jupyterfs

js:  ## build javascript
	yarn
	yarn build

labextension: js ## enable labextension
	python3.7 -m jupyter labextension install .

dist: js  ## create dists
	rm -rf dist build
	python3.7 setup.py sdist bdist_wheel

publish: dist  ## dist to pypi and npm
	twine check dist/* && twine upload dist/*
	npm publish

# Thanks to Francoise at marmelab.com for this
.DEFAULT_GOAL := help
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

print-%:
	@echo '$*=$($*)'

.PHONY: clean install serverextension labextension test tests help docs dist
