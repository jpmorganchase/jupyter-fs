testjs: ## Clean and Make js tests
	yarn test

testpy: ## Clean and Make py tests
	python3.7 -m pytest -v jupyterfs/tests --cov=jupyterfs --cov-branch

test: ## run all tests
	testpy
	testjs

lintjs: ## run linter
	yarn lint

lintpy: ## run linter
	flake8 jupyterfs setup.py

lint: ## run linter
	flake8 jupyterfs setup.py
	yarn lint

fixjs:  ## run autopep8/tslint fix
	./node_modules/.bin/tslint --fix src/*

fixpy:  ## run autopep8/tslint fix
	autopep8 --in-place -r -a -a jupyterfs/

fix:  ## run autopep8/tslint fix
	autopep8 --in-place -r -a -a jupyterfs/
	./node_modules/.bin/tslint --fix src/*

annotate: ## MyPy type annotation check
	mypy -s jupyterfs

annotate_l: ## MyPy type annotation check - count only
	mypy -s jupyterfs | wc -l

clean: ## clean the repository
	find . -name "__pycache__" | xargs  rm -rf
	find . -name "*.pyc" | xargs rm -rf
	find . -name ".ipynb_checkpoints" | xargs  rm -rf
	rm -rf .coverage coverage cover htmlcov logs build dist *.egg-info lib node_modules
	# make -C ./docs clean

dev_install: ## set up the repo for active development
	pip install -e .[dev]
	jupyter serverextension enable --py jupyterfs
	jlpm build:integrity
	jupyter labextension link .
	# verify
	jupyter serverextension list
	jupyter labextension list

docs:  ## make documentation
	make -C ./docs html
	open ./docs/_build/html/index.html

install:  ## install to site-packages
	pip3 install .

serverextension: install ## enable serverextension
	jupyter serverextension enable --py jupyterfs

js:  ## build javascript
	yarn
	yarn build

labextension: js ## enable labextension
	jupyter labextension install .

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
