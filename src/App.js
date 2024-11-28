import React, { useState, useEffect } from 'react';
import './App.css';
import CircularProgress from '@mui/material/CircularProgress';
import { Tabs, Tab, TextField } from '@mui/material';

const paramUsername = (new URLSearchParams(window.location.search)).get('username') || 'your-username-here.bsky.social';

function App() {
  const [username, setUsername] = useState(paramUsername);
  const [did, setDid] = useState('');
  const [error, setError] = useState(null);

  const [blockPage, setBlockPage] = useState(1);
  const [lastBlockCount, setLastBlockCount] = useState(100);
  const [blocklist, setBlocklist] = useState([]);

  const [listPage, setListPage] = useState(1);
  const [lastListCount, setLastListCount] = useState(100);
  const [lists, setLists] = useState([]);

  const [editing, setEditing] = useState(false);
  const [infoList, setInfoList] = useState([]);
  const [fetchingInfo, setFetchingInfo] = useState(false);
  const [tabValue, setTabValue] = useState(0);

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

    const redirectToUsername = async () => {
      try {
        const profileResponse = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${username}`);
        if (profileResponse.status !== 200) {
          setError("Profile not found");
          return;
        }
        const profileData = await profileResponse.json();
        const newUsername = profileData.handle;
        const params = new URLSearchParams(window.location.search);
        params.set('username', newUsername);
        window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
        window.location.reload();
      } catch (error) {
        setError(error.message);
      }
    }

    if (username && ! editing) {
      if (username.startsWith('did:')) {
        redirectToUsername();
      } else if (username !== 'your-username-here.bsky.social') {
        fetchDid();
      }
    }
  }, [username, editing]);

  useEffect(() => {
    const fetchPagedBlockList = async (username) => {
      try {
        // Fetch blocklist data until the blocklist array count is less than 100
        const urlToTry = `https://api.clearsky.services/api/v1/anon/single-blocklist/${did}${blockPage > 1 ? `/${blockPage}` : ''}`;
        console.log(urlToTry);
        let attempts = 0;
        let blocklistResponse;
        while (attempts < 10) {
          blocklistResponse = await fetch(urlToTry);
          if (blocklistResponse.status === 200) {
            break;
          }
          console.log(`Trying block ${blockPage} again...`);
          await new Promise((resolve) => setTimeout(resolve, 100));
          attempts++;
        }
        if (blocklistResponse.status !== 200) {
          throw new Error('Failed to fetch blocklist data after 10 attempts');
        }
        const blocklistData = await blocklistResponse.json();
        setLastBlockCount(blocklistData.data.blocklist.length);
        setBlocklist((prev) => [...prev, ...blocklistData.data.blocklist]);
        setBlockPage((prev) => prev + 1);
      } catch (error) {
        setError(error.message);
      }
    };

    if (did && lastBlockCount >= 100) {
      fetchPagedBlockList();
    }
  }, [did, blockPage, lastBlockCount]);

  useEffect(() => {
    const fetchPagedLists = async (username) => {
      try {
        // Fetch lists data until the lists array count is less than 100
        const urlToTry = `https://api.clearsky.services/api/v1/anon/get-list/${did}${listPage > 1 ? `/${listPage}` : ''}`;
        console.log(urlToTry);
        let attempts = 0;
        let listResponse;
        while (attempts < 10) {
          listResponse = await fetch(urlToTry);
          if (listResponse.status === 200) {
            break;
          }
          console.log(`Trying list ${listPage} again...`);
          await new Promise((resolve) => setTimeout(resolve, 100));
          attempts++;
        }
        if (listResponse.status !== 200) {
          throw new Error('Failed to fetch list data after 10 attempts');
        }
        const listData = await listResponse.json();
        setLastListCount(listData.data.lists.length);
        setLists((prev) => [...prev, ...listData.data.lists]);
        setListPage((prev) => prev + 1);
      } catch (error) {
        setError(error.message);
      }
    };

    if (did && lastListCount >= 100) {
      fetchPagedLists();
    }
  }, [did, listPage, lastListCount]);

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
            nextTen[blocklist[currentCount+i].did] = {handle: blocklist[currentCount+i].did};
          }
        } catch (error) {
          console.error(`Failed to fetch handle for DID: ${blocklist[i].did}`, error);
          nextTen[blocklist[currentCount+i].did] = {handle: blocklist[currentCount+i].did};
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

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>BlueSky Block Count</h1>
        <div>User:&nbsp;
        {editing ? (
          <TextField
            size="small"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                setEditing(false);
              }
            }}
            fullWidth
            sx={{ input: { color: 'white' } }}
            style={{ display: "inline" }}
          />
        ) : (
          <span
            style={{ color: 'white', cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => setEditing(true)}
          >
            {username}
          </span>
        )}
        {error ? <p>Error: {error}</p> : ''}
        <p>Block Count: {blocklist.length} </p>
        <p>List Count: {lists.length}</p>
        {lastBlockCount >= 100 && <CircularProgress size={30} style={{ color: 'white' }} />}
        </div>
      </header>
      <div>
          <Tabs value={tabValue} onChange={handleTabChange} centered>
            <Tab label="Blocks" />
            <Tab label="Lists" />
          </Tabs>
          {tabValue === 0 && (
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
                      <>&nbsp;<a href={`https://bsky.app/profile/${infoList[item.did]?.handle || item.did}`} target="_blank" rel="noreferrer" title="View their profile on BlueSky">{infoList[item.did]?.handle || item.did}</a> (<a href={`?username=${infoList[item.did]?.handle || item.did}`} title="View their block count">#</a>) (<a href={`https://clearsky.app/${infoList[item.did]?.handle || item.did}`} target="_blank" rel="noreferrer" title="View who they are blocking on clearsky.app">cs</a>)</>
                    </td>
                    <td data-label="When" title={item.blocked_date}>&nbsp;{getRelativeTime(item.blocked_date)}</td>
                    <td data-label="Name">&nbsp;{infoList[item.did]?.displayName || ''}</td>
                    <td data-label="Description">&nbsp;{infoList[item.did]?.description || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tabValue === 1 && (
            <table className="responsive-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>List Name</th>
                  <th>Description</th>
                  <th>Added</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {lists.sort((a, b) => new Date(b.date_added) - new Date(a.date_added)).map((item, index) => (
                  <tr key={index}>
                    <td data-label="#">&nbsp;{index + 1}</td>
                    <td data-label="List Name" style={{ textAlign: 'left' }}>
                      <>&nbsp;<a href={item.url.split('/lists/')[0]} target="_blank" rel="noreferrer" title="View the list on BlueSky">{item.name}</a></>
                    </td>
                    <td data-label="Description">&nbsp;{item.description || ''}</td>
                    <td data-label="Added" title={item.date_added}>&nbsp;{getRelativeTime(item.date_added)}</td>
                    <td data-label="Created" title={item.created_date}>&nbsp;{getRelativeTime(item.created_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
      </div>
  );
}

export default App;
