import React from 'react';
import ReactDOM from 'react-dom';
import Feed from './components/feed';
import NavBar from './components/navbar';
import LeftSideBar from './components/leftsidebar';
import RightSideBar from './components/rightsidebar';
import ChatPopup from './components/chatpopup';
import FeedItem from './components/feeditem';
import {hideElement} from './util';
import {searchForFeedItems, deleteFeedItem} from './server';
import { IndexRoute, Router, Route, hashHistory } from 'react-router'
import ErrorBanner from './components/errorbanner';

/**
 * A fake profile page.
 */
class ProfilePage extends React.Component {
  render() {
    return (
      <p>This is the profile page for a user with ID {this.props.params.id}.</p>
    );
  }
}

/**
 * The Feed page. We created a new component just to fix the userId at 4.
 */
class FeedPage extends React.Component {
  render() {
    return <Feed user={"000000000000000000000004"} />;
  }
}

/**
 * Search results page.
 */
class SearchResultsPage extends React.Component {
  getSearchTerm() {
    // If there's no query input to this page (e.g. /foo instead of /foo?bar=4),
    // query may be undefined. We have to check for this, otherwise
    // JavaScript will throw an exception and die!
    var queryVars = this.props.location.query;
    var searchTerm = "";
    if (queryVars && queryVars.q) {
      searchTerm = queryVars.q;
      // Remove extraneous whitespace.
      searchTerm.trim();
    }
    return searchTerm;
  }

  render() {
    var searchTerm = this.getSearchTerm();
    // By using the searchTerm as the key, React will create a new
    // SearchResults component every time the search term changes.
    return (
      <SearchResults key={searchTerm} searchTerm={searchTerm} />
    );
  }
}

class SearchResults extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loaded: false,
      invalidSearch: false,
      results: []
    };
  }

  deleteFeedItem(id) {
    deleteFeedItem(id, () => {
      this.refresh();
    });
  }

  refresh() {
    var searchTerm = this.props.searchTerm;
    if (searchTerm !== "") {
      searchForFeedItems(searchTerm, (feedItems) => {
        this.setState({
          loaded: true,
          results: feedItems
        });
      });
    } else {
      this.setState({
        invalidSearch: true
      });
    }
  }

  componentDidMount() {
    this.refresh();
  }

  render() {
    return (
      <div>
        <h2>Search Results for {this.props.searchTerm}</h2>
        <div className={hideElement(this.state.loaded || this.state.invalidSearch)}>Search results are loading...</div>
        <div className={hideElement(!this.state.invalidSearch)}>Invalid search query.</div>
        <div className={hideElement(!this.state.loaded)}>
          <div>Found {this.state.results.length} results.</div>
          {
            this.state.results.map((feedItem) => {
              return (
                <FeedItem key={feedItem._id} data={feedItem} onDelete={() => this.deleteFeedItem(feedItem._id)} />
              )
            })
          }
        </div>
      </div>
    );
  }
}


/**
 * The primary component in our application. Handles the overall layout
 * of the page.
 * The Router will give it different child Components as the user clicks
 * around the application.
 */
class App extends React.Component {
  render() {
    // If there's no query input to this page (e.g. /foo instead of /foo?bar=4),
    // query may be undefined. We have to check for this, otherwise
    // JavaScript will throw an exception and die!
    var queryVars = this.props.location.query;
    var searchTerm = null;
    if (queryVars && queryVars.searchTerm) {
      searchTerm = queryVars.searchTerm;
    }
    return (
      <div>
        <NavBar searchTerm={searchTerm} />
        <div className="container">
          <div className="row">
            <div className="col-md-12">
              <ErrorBanner />
            </div>
          </div>
          <div className="row">
            <div className="col-md-2 fb-left-sidebar">
              <LeftSideBar />
            </div>
            <div className="col-md-7">
              {this.props.children}
            </div>
            <div className="col-md-3 fb-right-sidebar">
              <RightSideBar />
            </div>
          </div>
        </div>
        <ChatPopup />
      </div>
    )
  }
}

ReactDOM.render((
  <Router history={hashHistory}>
    <Route path="/" component={App}>
      {/* Show the Feed at / */}
      <IndexRoute component={FeedPage} />
      <Route path="profile/:id" component={ProfilePage} />
      <Route path="search" component={SearchResultsPage} />
    </Route>
  </Router>
),document.getElementById('main_container'));
