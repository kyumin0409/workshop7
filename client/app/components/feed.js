import React from 'react';
import FeedItem from './feeditem';
import StatusUpdateEntry from './statusupdateentry';
import {getFeedData, postStatusUpdate, deleteFeedItem} from '../server';

export default class Feed extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      contents: []
    };
  }

  refresh() {
    getFeedData(this.props.user, (feedData) => {
      this.setState(feedData);
    });
  }

  deleteFeedItem(id) {
    deleteFeedItem(id, () => {
      this.refresh();
    });
  }

  onPost(postContents, image) {
    // Send to server.
    // We could use geolocation to get a location, but let's fix it to Amherst
    // for now.
    postStatusUpdate("000000000000000000000004", "Amherst, MA", postContents, image, () => {
      // Database is now updated. Refresh the feed.
      this.refresh();
    });
  }

  componentDidMount() {
    this.refresh();
  }

  render() {
    return (
      <div>
        <StatusUpdateEntry onPost={(postContents, image) => this.onPost(postContents, image)} />
        {this.state.contents.map((feedItem) => {
          return (
            <FeedItem key={feedItem._id} data={feedItem} onDelete={() => this.deleteFeedItem(feedItem._id)} />
          )
        })}
      </div>
    )
  }
}

Feed.contextTypes = {
    router: React.PropTypes.object.isRequired
};
