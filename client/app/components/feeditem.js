import React from 'react';
import StatusUpdate from './statusupdate';
import CommentThread from './commentthread';
import Comment from './comment';
import {postComment, likeFeedItem, unlikeFeedItem, likeComment, unlikeComment, updateFeedItemText} from '../server';

export default class FeedItem extends React.Component {
  constructor(props) {
    super(props);
    this.state = props.data;
  }

  handleCommentPost(commentText) {
    postComment(this.state._id, "000000000000000000000004", commentText, (updatedFeedItem) => {
      this.setState(updatedFeedItem);
    });
  }

  handleLikeClick(clickEvent) {
    clickEvent.preventDefault();
    // 0 represents the 'main mouse button' -- typically a left click
    // https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
    if (clickEvent.button === 0) {
      // Callback function for both the like and unlike cases.
      var callbackFunction = (updatedLikeCounter) => {
        // setState will overwrite the 'likeCounter' field on the current
        // state, and will keep the other fields in-tact.
        // This is called a shallow merge:
        // https://facebook.github.io/react/docs/component-api.html#setstate
        this.setState({likeCounter: updatedLikeCounter});
      };

      if (this.didUserLike()) {
        // User clicked 'unlike' button.
        unlikeFeedItem(this.state._id, "000000000000000000000004", callbackFunction);
      } else {
        // User clicked 'like' button.
        likeFeedItem(this.state._id, "000000000000000000000004", callbackFunction);
      }
    }
  }

  /**
   * Returns 'true' if the user liked the item.
   * Returns 'false' if the user has not liked the item.
   */
  didUserLike() {
    var likeCounter = this.state.likeCounter;
    var liked = false;
    for (var i = 0; i < likeCounter.length; i++) {
      if (likeCounter[i]._id === "000000000000000000000004") {
        liked = true;
        break;
      }
    }
    return liked;
  }

  onCommentLike(id, isLike) {
    var cb = (comment) => {
      var comments = this.state.comments;
      comments[id] = comment;
      this.setState({comments: comments});
    };
    if (isLike) {
      likeComment(this.state._id, id, "000000000000000000000004", cb);
    } else {
      unlikeComment(this.state._id, id, "000000000000000000000004", cb);
    }
  }

  onContentUpdate(newContent) {
    updateFeedItemText(this.state._id, newContent, (updatedFeedItem) => {
      this.setState(updatedFeedItem);
    });
  }

  render() {
    var likeButtonText = "Like";
    if (this.didUserLike()) {
      likeButtonText = "Unlike";
    }
    var data = this.state;
    var contents;
    switch(data.type) {
      case "statusUpdate":
        // Create a StatusUpdate. Dynamically created React component: needs a key.
        // Keys only need to be unique among *siblings*, so we can re-use the
        // same key as the FeedItem.
        contents = (
          <StatusUpdate key={data._id} onDelete={this.props.onDelete} onContentUpdate={(newContent) => this.onContentUpdate(newContent)} author={data.contents.author} postDate={data.contents.postDate} location={data.contents.location} value={data.contents.contents} image={data.contents.image} />
        );
        break;
      default:
        throw new Error("Unknown FeedItem: " + data.type);
    }

    return (
      <div className="fb-status-update panel panel-default">
        <div className="panel-body">
          {contents}
          <hr />
          <div className="row">
            <div className="col-md-12">
              <ul className="list-inline">
                <li>
                <a href="#" onClick={(e) => this.handleLikeClick(e)}>
                  <span className="glyphicon glyphicon-thumbs-up"></span> {likeButtonText}
                </a>
                </li>
                <li>
                <a href="#"><span className="glyphicon glyphicon-comment"></span> Comment</a>
                </li>
                <li>
                <a href="#"><span className="glyphicon glyphicon-share-alt"></span> Share</a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="panel-footer">
          <div className="row">
            <div className="col-md-12">
              <a href="#">{data.likeCounter.length} people</a> like this
            </div>
          </div>
          <hr />
          <CommentThread onPost={(commentText) => this.handleCommentPost(commentText)}>
            {data.comments.map((comment, i) => {
              // i is comment's index in comments array
              return (
                <Comment key={i} id={i} onLike={(id) => this.onCommentLike(id, true)} onUnlike={(id) => this.onCommentLike(id, false)} author={comment.author} postDate={comment.postDate} likeCounter={comment.likeCounter}>{comment.contents}</Comment>
              );
            })}
          </CommentThread>
        </div>
      </div>
    )
  }
}
