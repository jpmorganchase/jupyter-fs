# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#
import os
from string import Template

__all__ = ['BraceTemplate', 'DoubleBraceTemplate', 'substituteAsk', 'substituteEnv', 'substituteNone']


class _BaseTemplate(Template):
    def tokens(self):
        return [m[0] for m in self.pattern.findall(self.template)]


class BraceTemplate(_BaseTemplate):
    """Template subclass that will replace any '{VAR}'
    """
    delimiter = ''
    pattern = r'''
    (?:
      [^{]{(?P<braced>\S+?)}[^}]    | # match anything in single braces
      (?P<escaped>a^)              | # match nothing
      (?P<named>a^)                | # match nothing
      (?P<invalid>a^)                # match nothing
    )
    '''


class DoubleBraceTemplate(_BaseTemplate):
    """Template subclass that will replace any '{{VAR}}'
    """
    delimiter = ''
    pattern = r'''
    (?:
      {{(?P<braced>\S+?)}}    | # match anything in double braces
      (?P<escaped>a^)        | # match nothing
      (?P<named>a^)          | # match nothing
      (?P<invalid>a^)          # match nothing
    )
    '''

def substituteAsk(resource):
    if 'tokenDict' in resource:
        url = DoubleBraceTemplate(resource['url']).substitute(resource.pop('tokenDict'))
    else:
        url = resource['url']

    # return the substituted string and the names of any missing vars
    return url, DoubleBraceTemplate(url).tokens()

def substituteEnv(resource):
    url = DoubleBraceTemplate(resource['url']).substitute(os.environ)

    # return the substituted string and the names of any missing vars
    return url, DoubleBraceTemplate(url).tokens()

def substituteNone(resource):
    url = resource['url']

    return url, DoubleBraceTemplate(url).tokens()
