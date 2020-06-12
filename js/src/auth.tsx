import {Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField} from '@material-ui/core';
import * as React from 'react';

import { IFSResourceSpec } from './filesystem';

export class AskDialog<
  P extends AskDialog.IProps = AskDialog.IProps,
  S extends AskDialog.IState = AskDialog.IState
> extends React.Component<P, S> {
  constructor(props: P) {
    super(props);

    this.state = {...AskDialog.initialState} as Readonly<S>;
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
              Subscribe
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
          margin="dense"
          id={key}
          label={key}
          // type="email"
          fullWidth
        />
      );
    });
  }

  protected _onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const target = event.target;
    const name = target.name as keyof S;

    this.setState({
      [name]: target.value
    } as any);
  }

  protected _onOpen() {
    this.setState({ open: true });
  }

  protected _onClose() {
    // close the dialog and blank the form
    this.setState({ open: false });
  };

  protected async _onSubmit(
    event: React.FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();
    await this.props.handleSubmit(this.state);
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
    handleSubmit: (state: IState) => void;
    keys: string[];
    resource: IFSResourceSpec;
  }

  /**
   * The initial state for a new AskDialog
   */
  export const initialState = {
    open: false
  }

  /**
   * The state for an AskDialog component
   */
  export type IState = typeof initialState;
}
