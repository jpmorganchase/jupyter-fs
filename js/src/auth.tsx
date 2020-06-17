import {Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, InputAdornment, TextField} from '@material-ui/core';
import * as React from 'react';

import {visibilityIcon, visibilityOffIcon} from './icons';
import { IFSResourceSpec } from './filesystem';

export class AskDialog<
  P extends AskDialog.IProps = AskDialog.IProps,
  S extends AskDialog.IState = AskDialog.IState
> extends React.Component<P, S> {
  constructor(props: P) {
    super(props);

    this.state = AskDialog.initialState() as Readonly<S>;
  }

  render() {
    return (
      <div>
        <Dialog open={this.state.open} onClose={this._onClose}>
          <DialogTitle>{`Please enter fields for filesystem resource ${this.props.resource.name}`}</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {this.props.resource.url}
            </DialogContentText>
            <form className="jfs-ask-form" onSubmit={this._onSubmit} noValidate autoComplete="off">
              <ul className="jfs-ask-form-list">{this._inputs()}</ul>
            </form>
          </DialogContent>
          <DialogActions>
            <Button onClick={this._onClose} color="primary">
              Cancel
            </Button>
            <Button onClick={this._onClose} color="primary">
              Submit
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    );
  }

  protected _inputs(): React.ReactNodeArray {
    return this.props.keys.map(key => {
      return (
        <TextField
          autoFocus
          fullWidth
          label={key}
          margin="dense"
          name={key}
          onChange={this._onChange}
          type="password"
          value={this.state.values[key]}
          InputProps={{
            startAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={this._onClickVisiblity(key)}
                  onMouseDown={this._onMouseDownVisibility}
                  edge="end"
                >
                  {this.state.visibility[key] ? visibilityIcon.react : visibilityOffIcon.react}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      );
    });
  }

  protected _onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const target = event.target;
    this._setValue(target.name, target.value);
  }

  protected _onClickVisiblity(key: string) {
    return function() {
      this._toggleVisibility(key);
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
  };

  protected async _onSubmit(
    event: React.FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();
    await this.props.handleSubmit(this.state.values);
  }

  protected _setValue(key: string, value: string) {
    this.setState({
      values: {...this.state.values, [key]: value}
    });
  }

  protected _toggleVisibility(key: string) {
    this.setState({
      visibility: {...this.state.visibility, [key]: !this.state.visibility[key]}
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
    handleSubmit: (values: {[key: string]: string}) => void;
    keys: string[];
    resource: IFSResourceSpec;
  }

  /**
   * The initial state for a new AskDialog
   */
  export const initialState = () => {return {
    open: false,
    values: {} as {[key: string]: string},
    visibility: {} as {[key: string]: string},
  }}

  /**
   * The state for an AskDialog component
   */
  export type IState = ReturnType<typeof initialState>;
}
