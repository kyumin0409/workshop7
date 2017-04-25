import React from 'react';
import {unixTimeToString} from '../util';
import {Link} from 'react-router';

export default class Comment extends React.Component {
  didUserLike() {
    return this.props.likeCounter.indexOf("000000000000000000000004") !== -1;
  }

  handleLikeClick(e) {
    e.preventDefault();
    if (e.button === 0) {
      if (this.didUserLike()) {
        this.props.onUnlike(this.props.id);
      } else {
        this.props.onLike(this.props.id);
      }
    }
  }

  render() {
    return (
      <div>
        <div className="media-left media-top">
          PIC
        </div>
        <div className="media-body">
          <Link to={"/profile/" + this.props.author._id}>{this.props.author.fullName}</Link> {this.props.children}
          <br /><a onClick={(e) => this.handleLikeClick(e)} href="#">{this.didUserLike() ? 'Unlike' : 'Like'}</a> · <a href="#">Reply</a> · {unixTimeToString(this.props.postDate)}
        </div>
      </div>
    )
  }
}
