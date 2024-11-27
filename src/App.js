import React, { useState, useEffect } from 'react';
import './App.css';

const paramUsername = (new URLSearchParams(window.location.search)).get('username') || 'trumpisourguy1.bsky.social';

function App() {
  const [page, setPage] = useState(1);
  const [lastBatchCount, setLastBatchCount] = useState(100);
  const [error, setError] = useState(null);
  const [username, setUsername] = useState(paramUsername);
  const [did, setDid] = useState('');
  const [blocklist, setBlocklist] = useState([]);
  const [editing, setEditing] = useState(false);
  const [infoList, setInfoList] = useState([]);
  const [fetchingInfo, setFetchingInfo] = useState(false);

  useEffect(() => {
    if (username !== paramUsername && !editing) {
      const params = new URLSearchParams(window.location.search);
      params.set('username', username);
      window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
      window.location.reload();
    }
  }, [username, editing]);

  useEffect(() => {
    const fetchDid = async () => {
      try {
        // Fetch the DID
        const didResponse = await fetch(`https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${username}`);
        if (didResponse.status !== 200) {
          setError("User not found");
          return;
        }
        const didData = await didResponse.json();
        setDid(didData.did);
      } catch (error) {
        setError(error.message);
      }
    };

    if (username) {
      fetchDid();
    }
  }, [username]);

  useEffect(() => {
    const fetchPagedBlockList = async (username) => {
      try {
        // Fetch blocklist data until the blocklist array count is less than 100
        const urlToTry = `https://api.clearsky.services/api/v1/anon/single-blocklist/${did}${page > 1 ? `/${page}` : ''}`;
        console.log(urlToTry);
        let attempts = 0;
        let blocklistResponse;
        while (attempts < 10) {
          blocklistResponse = await fetch(urlToTry);
          if (blocklistResponse.status === 200) {
            break;
          }
          console.log(`Trying ${page} again...`);
          await new Promise((resolve) => setTimeout(resolve, 100));
          attempts++;
        }
        if (blocklistResponse.status !== 200) {
          throw new Error('Failed to fetch blocklist data after 10 attempts');
        }
        const blocklistData = await blocklistResponse.json();
        setLastBatchCount(blocklistData.data.blocklist.length);
        setBlocklist((prev) => [...prev, ...blocklistData.data.blocklist]);
        setPage((prev) => prev + 1);
      } catch (error) {
        setError(error.message);
      }
    };

    if (did && lastBatchCount >= 100) {
      fetchPagedBlockList();
    }
  }, [did, page, lastBatchCount]);

  useEffect(() => {
    const fetchInfo = async () => {
      const nextTen = {};
      const currentCount = Object.keys(infoList).length;
      for (let i = 0; i < 10 && (i + currentCount) < blocklist.length; i++) {
        console.log(`Fetching info for blocklist ${currentCount + i}`);
        await new Promise((resolve) => setTimeout(resolve, 100));
        try {
          const handleResponse = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${blocklist[currentCount + i].did}`);
          if (handleResponse.status === 200) {
            nextTen[blocklist[currentCount+i].did] = await handleResponse.json();
          } else {
            nextTen[blocklist[currentCount+i].did] = {handle: 'Failed to fetch handle'};
          }
        } catch (error) {
          console.error(`Failed to fetch handle for DID: ${blocklist[i].did}`, error);
          nextTen[blocklist[currentCount+i].did] = {handle: 'Failed to fetch handle'};
        }
      }
      setInfoList(prev => {return {...prev, ...nextTen}});
      setFetchingInfo(false);
    };

    if (blocklist.length > Object.keys(infoList).length && !fetchingInfo) {
      setFetchingInfo(true);
      fetchInfo();
    }
  }, [blocklist, infoList, fetchingInfo]);

  const getRelativeTime = (date) => {
    const now = new Date();
    const diff = Math.floor((now - new Date(date)) / 1000); // difference in seconds

    if (diff < 60) return `${diff} seconds ago`;
    const diffMinutes = Math.floor(diff / 60);
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>BlueSky Block Count</h1>
        <div>User:&nbsp;
        {editing ? (
          <input
            type="text"
            style={{display: "inline", width: "200px"}}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                setEditing(false);
              }
            }}
          />
        ) : (
          <span
            style={{ color: 'white', cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => setEditing(true)}
          >
            {username}
          </span>
        )}
        {error ? <p>Error: {error}</p> : <p>Block Count: {blocklist.length}{lastBatchCount >= 100 ? '.'.repeat((blocklist.length % 3) + 1) : ''}</p>}
        </div>
      </header>
      <table className="responsive-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Handle/DID</th>
            <th>When</th>
            <th>Name</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {blocklist.map((item, index) => (
            <tr key={index}>
              <td data-label="#">&nbsp;{index + 1}</td>
              <td data-label="Handle/DID" style={{ textAlign: 'left' }}>
               &nbsp;<a href={`https://bsky.app/profile/${infoList[item.did]?.handle || item.did}`} target="_blank" rel="noreferrer" title="View their profile on BlueSky">{infoList[item.did]?.handle || item.did}</a> {infoList[item.did] ? <>(<a href={`?username=${infoList[item.did].handle}`} title="View their block count">#</a>) (<a href={`https://clearsky.app/${infoList[item.did].handle}`} target="_blank" rel="noreferrer" title="View who they are blocking on clearsky.app">cs</a>)</> : ''} 
              </td>
              <td data-label="When" title={item.blocked_date}>&nbsp;{getRelativeTime(item.blocked_date)}</td>
              <td data-label="Name">&nbsp;{infoList[item.did]?.displayName || ''}</td>
              <td data-label="Description">&nbsp;{infoList[item.did]?.description || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
