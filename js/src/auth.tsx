/******************************************************************************
 *
 * Copyright (c) 2019, the jupyter-fs authors.
 *
 * This file is part of the jupyter-fs library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import {Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, InputAdornment, TextField, Paper} from '@material-ui/core';
import * as React from 'react';

import { IFSResource } from './filesystem';
import {visibilityIcon, visibilityOffIcon} from './icons';

class Template {
  public pattern = /(?:)/;

  constructor(public template: string) {}

  substitute(dict: {[key: string]: string}) {
    return this.template.replace(this.pattern, (_, p1) => dict[p1]);
  }

  tokens() {
    return this.template.match(this.pattern) || [];
  }
}

export class DoubleBraceTemplate extends Template {
  public pattern = /(?<=\{\{)\w*?(?=\}\})/g;
}

function keysFromUrl(url: string): string[] {
  return new DoubleBraceTemplate(url).tokens();
}

function _askRequired(spec: IFSResource) {
  return spec.auth === 'ask' && !spec.init;
}

export function askRequired(specs: IFSResource[]) {
  for (const spec of specs) {
    if (_askRequired(spec)) {
      return true;
    }
  }

  return false;
}

export class AskDialog<
  P extends AskDialog.IProps = AskDialog.IProps,
  S extends AskDialog.IState = AskDialog.IState
> extends React.Component<P, S> {
  static displayName = "AskDialog";

  constructor(props: P) {
    super(props);

    this.state = {...AskDialog.initialState(), open: true} as Readonly<S>;
  }

  render() {
    return (
      <div>
        <Dialog className="jfs-ask-dialog" open={this.state.open} onClose={this._onClose.bind(this)}>
          <DialogTitle>Please enter fields for filesystem resources</DialogTitle>
          <DialogContent>
            {this._form()}
          </DialogContent>
          <DialogActions>
            <Button onClick={this._onClose.bind(this)} color="primary">
              Cancel
            </Button>
            <Button onClick={this._onSubmit.bind(this)} color="primary">
              Submit
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    );
  }

  protected _form() {
    return (
      <form className="jfs-ask-form" onSubmit={this._onSubmit.bind(this)} noValidate autoComplete="off">
        {this._formInner()}
      </form>
    )
  }

  protected _formInner() {
    return this.props.specs.map((spec) => {
      // only ask for spec credentials if explicitly requested
      const inputs = _askRequired(spec) ? this._inputs(spec.url) : [];

      return [
        <Paper className="jfs-ask-paper" elevation={2} variant="outlined" key={`${spec.url}_p`}>
          <DialogContentText>{`${spec.url}: `}</DialogContentText>
          {inputs.length ? inputs : <DialogContentText>None</DialogContentText>}
        </Paper>
      ];
    });
  }

  protected _inputs(url: string): React.ReactNodeArray {
    return keysFromUrl(url).map(key => {
      return (
        <TextField
          autoFocus
          fullWidth
          key={`${url}_${key}`}
          label={key}
          margin="dense"
          name={key}
          onChange={this._onChange(url).bind(this)}
          type={this.state.visibility[url]?.[key] ? 'text' : 'password'}
          value={this.state.values[url]?.[key] || ''}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={this._onClickVisiblity(url, key).bind(this)}
                  onMouseDown={this._onMouseDownVisibility.bind(this)}
                  edge="end"
                >
                  {this.state.visibility[url]?.[key] ? <visibilityIcon.react/> : <visibilityOffIcon.react/>}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      );
    });
  }

  protected _onChange(url: string) {
    return function(event: React.ChangeEvent<HTMLInputElement>) {
      const target = event.target;
      this._setValue(url, target.name, target.value);
    }
  }

  protected _onClickVisiblity(url: string, key: string) {
    return function() {
      this._toggleVisibility(url, key);
    }
  };

  protected _onMouseDownVisibility(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
  };

  protected _onOpen() {
    this.setState({ open: true });
  }

  protected _onClose() {
    // close the dialog and blank the form
    this.setState(AskDialog.initialState());
    this.props.handleClose();
  };

  protected async _onSubmit(
    event: React.FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    this.props.handleSubmit(this.state.values);
    this._onClose();
  }

  protected _setValue(url: string, key: string, value: string) {
    const urlValues = {...this.state.values[url], [key]: value};
    this.setState({
      values: {...this.state.values, [url]: urlValues}
    });
  }

  protected _toggleVisibility(url: string, key: string) {
    const urlVis = {...this.state.visibility[url], [key]: !this.state.visibility[url]?.[key]};
    this.setState({
      visibility: {...this.state.visibility, [url]: urlVis}
    });
  }
}

/**
 * A namespace for AskDialog statics.
 */
export namespace AskDialog {
  /**
   * The input props for an AskDialog component
   */
  export interface IProps {
    handleClose: () => void;
    handleSubmit: (values: {[url: string]: {[key: string]: string}}) => void;
    specs: IFSResource[];
  }

  /**
   * The initial state for a new AskDialog
   */
  export const initialState = () => {return {
    open: false,
    values: {} as {[url: string]: {[key: string]: string}},
    visibility: {} as {[url: string]: {[key: string]: string}},
  }}

  /**
   * The state for an AskDialog component
   */
  export type IState = ReturnType<typeof initialState>;
}
