# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#
import os
from string import Template

__all__ = []


class BaseTemplate(Template):
    def tokens(self):
        return [m[0] for m in self.pattern.findall(self.template)]


class BraceTemplate(BaseTemplate):
    """Template subclass that will replace any '{VAR}'
    """
    delimiter = ''
    pattern = '''
    (?:
      [^\{]{(?P<braced>\w*)}[^\}]    | # match anything in single braces
      (?P<escaped>a^)                | # match nothing
      (?P<named>a^)                  | # match nothing
      (?P<invalid>a^)                  # match nothing
    )
    '''


class DoubleBraceTemplate(BaseTemplate):
    """Template subclass that will replace any '{{VAR}}'
    """
    delimiter = ''
    pattern = '''
    (?:
      {{(?P<braced>\w*)}}    | # match anything in double braces
      (?P<escaped>a^)        | # match nothing
      (?P<named>a^)          | # match nothing
      (?P<invalid>a^)          # match nothing
    )
    '''


def substituteEnv(s):
    s = DoubleBraceTemplate(s).substitute(os.environ)

    # return the substituted string and the names of any missing vars
    return s, DoubleBraceTemplate(s).tokens()
