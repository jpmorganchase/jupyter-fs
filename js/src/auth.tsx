/******************************************************************************
 *
 * Copyright (c) 2019, the jupyter-fs authors.
 *
 * This file is part of the jupyter-fs library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ExpansionPanel,
  ExpansionPanelSummary,
  Typography,
  ExpansionPanelDetails,
  TextField,
  InputAdornment,
  IconButton,
} from "@material-ui/core";
import * as React from "react";

import { IFSOptions, IFSResource } from "./filesystem";
import { visibilityIcon, visibilityOffIcon } from "./icons";

class Template {
  pattern = /(?:)/;

  constructor(public template: string) {}

  substitute(dict: { [key: string]: string }) {
    return this.template.replace(this.pattern, (_, p1) => dict[p1]);
  }

  tokens() {
    const toks = [];
    let match;
    // eslint-disable-next-line no-cond-assign
    while ((match = this.pattern.exec(this.template))) {
      toks.push(match[1]);
    }
    return toks;
  }
}

export class DoubleBraceTemplate extends Template {
  pattern = /{{(\S+?)}}/g;
}

function tokensFromUrl(url: string): string[] {
  return new DoubleBraceTemplate(url).tokens();
}

function _askRequired(spec: IFSResource) {
  return spec.auth === "ask" && !spec.init;
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

  constructor(props: P, options: IFSOptions) {
    super(props);

    this.state = AskDialog.initialState({ open: true, options }) as Readonly<S>;
  }

  render() {
    return (
      <div>
        <Dialog
          className="jfs-ask-dialog"
          open={this.state.open}
          onClose={this._onClose.bind(this)}
        >
          <DialogTitle className="jfs-ask jfs-ask-dialog-title">
            Please enter token values for filesystem resources
          </DialogTitle>
          <DialogContent className="jfs-ask jfs-ask-dialog-content">
            {this._form()}
          </DialogContent>
          <DialogActions className="jfs-ask jfs-ask-dialog-actions">
            <Button
              className="jfs-ask jfs-ask-dialog-actions-button-cancel"
              onClick={this._onClose.bind(this)}
              color="primary"
            >
              Cancel
            </Button>
            <Button
              className="jfs-ask jfs-ask-dialog-actions-button-submit"
              onClick={this._onSubmit.bind(this)}
              color="primary"
            >
              Submit
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    );
  }

  protected _form() {
    return (
      <form
        className="jfs-ask jfs-ask-form"
        onSubmit={this._onSubmit.bind(this)}
        noValidate
        autoComplete="off"
      >
        {this._formInner()}
      </form>
    );
  }

  protected _formInner() {
    return this.props.resources.map(resource => {
      // ask for credentials if needed, or state why not
      const askReq = _askRequired(resource);
      const inputs = askReq ? this._inputs(resource.url) : [];
      const tokens = tokensFromUrl(resource.url);

      let reason = "";
      if (resource.init && this.props.options.cache) {
        reason = "already initialized";
      } else if (!tokens.length) {
        reason = "no template parameters";
      }

      const summary = `${resource.name}:${reason && ` ${reason}`}`;

      return [
        <ExpansionPanel
          className="jfs-ask jfs-ask-panel"
          disabled={!!reason}
          expanded={!reason}
          key={`${resource.name}_panel`}
        >
          <ExpansionPanelSummary className="jfs-ask jfs-ask-panel-summary">
            <Typography>{summary}</Typography>
            {!reason && <Typography>{resource.url}</Typography>}
          </ExpansionPanelSummary>
          <ExpansionPanelDetails className="jfs-ask jfs-ask-panel-details">
            {inputs}
          </ExpansionPanelDetails>
        </ExpansionPanel>,
      ];
    });
  }

  protected _inputs(url: string): React.ReactNodeArray {
    return tokensFromUrl(url).map(token => (
      <TextField
        className="jfs-ask jfs-ask-input"
        autoFocus
        fullWidth
        key={`${url}_${token}`}
        label={token}
        margin="dense"
        name={token}
        onChange={this._onChange(url).bind(this)}
        type={this.state.visibility[url]?.[token] ? "text" : "password"}
        value={this.state.values[url]?.[token] || ""}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                onClick={this._onClickVisiblity(url, token).bind(this)}
                onMouseDown={this._onMouseDownVisibility.bind(this)}
                edge="end"
              >
                {this.state.visibility[url]?.[token] ? (
                  <visibilityIcon.react />
                ) : (
                  <visibilityOffIcon.react />
                )}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
    ));
  }

  protected _onChange(url: string) {
    return function(event: React.ChangeEvent<HTMLInputElement>) {
      const target = event.target;
      this._setValue(url, target.name, target.value);
    };
  }

  protected _onClickVisiblity(url: string, key: string) {
    return function() {
      this._toggleVisibility(url, key);
    };
  }

  protected _onMouseDownVisibility(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
  }

  protected _onOpen() {
    this.setState({ open: true });
  }

  protected _onClose() {
    // close the dialog and blank the form
    this.setState(AskDialog.initialState({ options: this.state.options }));
    this.props.handleClose();
  }

  protected async _onSubmit(
    event: React.FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    this.props.handleSubmit(this.state.values);
    this._onClose();
  }

  protected _setValue(url: string, key: string, value: string) {
    const urlValues = { ...this.state.values[url], [key]: value };
    this.setState({
      values: { ...this.state.values, [url]: urlValues },
    });
  }

  protected _toggleVisibility(url: string, key: string) {
    const urlVis = {
      ...this.state.visibility[url],
      [key]: !this.state.visibility[url]?.[key],
    };
    this.setState({
      visibility: { ...this.state.visibility, [url]: urlVis },
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
    handleSubmit: (values: {
      [url: string]: { [key: string]: string };
    }) => void;
    options: IFSOptions;
    resources: IFSResource[];
  }

  /**
   * The initial state for a new AskDialog
   */
  export const initialState = ({
    open = false,
    options,
  }: {
    open?: boolean;
    options: IFSOptions;
  }) => ({
    open,
    options: { ...options },
    values: {} as { [url: string]: { [key: string]: string } },
    visibility: {} as { [url: string]: { [key: string]: string } },
  });

  /**
   * The state for an AskDialog component
   */
  export type IState = ReturnType<typeof initialState>;
}
