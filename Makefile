DOCKER_COMPOSE := podman-compose
YARN := jlpm

###############
# Build Tools #
###############
.PHONY: build develop install
build:  ## build python/javascript
	python -m build .

develop:  ## install to site-packages in editable mode
	python -m pip install --upgrade build jupyterlab pip setuptools twine wheel
	python -m pip install -vvv .[develop]

install:  ## install to site-packages
	python -m pip install .

###########
# Testing #
###########
.PHONY: setup-infra-ubuntu setup-infra-mac setup-infra-win setup-infra-common teardown-infra-ubuntu teardown-infra-mac teardown-infra-win teardown-infra-common dockerup dockerdown dockerlogs testpy testjs test tests

setup-infra-ubuntu: dockerup

setup-infra-mac:
	ci/mac/add_etc_hosts.sh
	ci/mac/enable_sharing.sh

setup-infra-win:

setup-infra-common:
	. ci/generate_jupyter_config.sh

teardown-infra-ubuntu: dockerdown

teardown-infra-mac:

teardown-infra-win:

teardown-infra-common:

dockerup:
	${DOCKER_COMPOSE} -f ci/docker-compose.yml up -d

dockerdown:
	${DOCKER_COMPOSE} -f ci/docker-compose.yml down || echo "can't teardown docker compose"

dockerlogs:
	${DOCKER_COMPOSE} -f ci/docker-compose.yml logs

testpy: ## Clean and Make unit tests
	python -m pytest -v jupyterfs/tests --junitxml=junit.xml --cov=jupyterfs --cov-report=xml:.coverage.xml --cov-branch --cov-fail-under=20 --cov-report term-missing

testjs: ## Clean and Make js tests
	cd js; ${YARN} test

test: tests
tests: testpy testjs ## run the tests

###########
# Linting #
###########
.PHONY: lintpy lintjs lint fixpy fixjs fix format

lintpy:  ## Lint Python with Ruff
	python -m ruff check jupyterfs setup.py
	python -m ruff format --check jupyterfs setup.py

lintjs:  ## Lint Javascript with ESlint
	cd js; ${YARN} lint

lint: lintpy lintjs  ## run linter

fixpy:  ## Autoformat Python with Ruff
	python -m ruff format jupyterfs/ setup.py

fixjs:  ## Autoformat JavaScript with ESlint
	cd js; ${YARN} fix

fix: fixpy fixjs  ## run black/tslint fix
format: fix

#################
# Other Checks #
#################
.PHONY: check checks check-manifest semgrep

check: checks

checks: check-manifest  ## run security, packaging, and other checks

check-manifest:  ## run manifest checker for sdist
	check-manifest -v

semgrep:  ## run semgrep
	semgrep ci --config auto

################
# Distribution #
################
.PHONY: dist publishpy publishjs publish

dist: build  ## create dists
	python -m twine check dist/*

publishpy:  ## dist to pypi
	python -m twine upload dist/* --skip-existing

publishjs:  ## dist to npm
	cd js; npm publish || echo "can't publish - might already exist"

publish: dist publishpy publishjs  ## dist to pypi and npm

############
# Cleaning #
############
.PHONY: clean

clean: ## clean the repository
	find . -name "__pycache__" | xargs  rm -rf
	find . -name "*.pyc" | xargs rm -rf
	find . -name ".ipynb_checkpoints" | xargs  rm -rf
	rm -rf .coverage coverage *.xml build dist *.egg-info lib node_modules .pytest_cache *.egg-info
	rm -rf jupyterfs/labextension jupyterfs/nbextension/static/index*
	cd js && ${YARN} clean
	git clean -fd

###########
# Helpers #
###########
# Thanks to Francoise at marmelab.com for this
.DEFAULT_GOAL := help
.PHONY: help
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

print-%:
	@echo '$*=$($*)'
