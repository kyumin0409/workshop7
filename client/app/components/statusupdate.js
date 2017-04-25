import React from 'react';
import {unixTimeToString, hideElement} from '../util';
import {Link} from 'react-router';

function countLines(str) {
  // Number of lines is the number of newlines plus 1.
  // Example:
  // "Fee\nFi\nFo\nFum" is:
  // Fee
  // Fi
  // Fo
  // Fum
  // Three newlines, four lines of text.
  var count = 1;
  for (var i = 0; i < str.length; i++) {
    if (str[i] === '\n') {
      count++;
    }
  }
  return count;
}

export default class StatusUpdate extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      // If 'true', the user is currently editing the status update.
      editing: false,
      // If 'true', the user clicked 'edit', and the status update is waiting
      // for the edit to occur.
      editSubmitted: false,
      // The current value of the edited status update. As the user types data into
      // the edit box, this value updates.
      editedValue: ''
    };
  }

  onEditClick(e) {
    e.preventDefault();
    this.setState({
      editing: true,
      editSubmitted: false,
      editedValue: this.props.value
    });
  }

  onEditCancel(e) {
    e.preventDefault();
    this.setState({
      editing: false,
      editSubmitted: false
    });
  }

  onEdit(e) {
    e.preventDefault();
    this.props.onContentUpdate(this.state.editedValue);
    this.setState({
      editSubmitted: true
    });
  }

  onDelete(e) {
    e.preventDefault();
    this.props.onDelete();
  }

  handleEditChange(e) {
    e.preventDefault();
    this.setState({ editedValue: e.target.value });
  }

  componentWillReceiveProps() {
    if (this.state.editing && this.state.editSubmitted) {
      // Component has received its new status update text!
      this.setState({
        editing: false,
        editSubmitted: false
      });
    }
  }

  render() {
    return (
      <div>
        <div className="row">
          <div className="col-md-10">
            <div className="media">
              <div className="media-left media-top">
                PIC
              </div>
              <div className="media-body">
                <Link to={"/profile/" + this.props.author._id}>{this.props.author.fullName}</Link>
                <br /> {unixTimeToString(this.props.postDate)} · {this.props.location} · <span className="glyphicon glyphicon-user"></span>
              </div>
            </div>
          </div>
          <div className="col-md-2">
            <div className={"dropdown"}>
              <span className="caret pull-right dropdown-toggle" data-toggle="dropdown"></span>
              <ul className="dropdown-menu">
                <li className={hideElement(this.props.author._id !== "000000000000000000000004")}><a onClick={(e) => this.onEditClick(e)}>Edit Status Update</a></li>
                <li className={hideElement(this.props.author._id !== "000000000000000000000004")}><a onClick={(e) => this.onDelete(e)}>Delete Status Update</a></li>
                <li><a href="#">Hide Post</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="row">
          <div className="col-md-12">
            <span className={hideElement(!this.state.editing)}>
              <textarea disabled={this.state.editSubmitted} className="form-control fb-status-update-edit-box" rows={countLines(this.state.editedValue).toString()} value={this.state.editedValue} onChange={(e) => this.handleEditChange(e)} />
              <span className="fb-status-update-edit-buttons">
                <div className="btn-group">
                  <button className="btn btn-default" onClick={(e) => this.onEditCancel(e)} disabled={this.state.editSubmitted}>Cancel</button>
                </div>
                <div className="btn-group pull-right">
                  <button className="btn btn-default" onClick={(e) => this.onEdit(e)} disabled={this.state.editSubmitted}>Edit</button>
                </div>
              </span>
            </span>
            <span className={hideElement(this.state.editing)}>
            {
              this.props.value.split('\n').map((line, i) => {
                return <p key={"line" + i}>{line}</p>
              })
            }
            </span>
          </div>
        </div>
        <div className="row">
          <div className="col-md-12">
            {
              /*
                  this.props.image is a data URI, so we can plug it in as the source
                  of an image and it will display!
               */
            }
            <img className={hideElement(typeof(this.props.image) !== "string")} style={{width: "100%"}} src={this.props.image} />
          </div>
        </div>
      </div>
    )
  }
}
