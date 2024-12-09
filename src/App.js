import React, { useState, useEffect } from 'react';
import './App.css';
import CircularProgress from '@mui/material/CircularProgress';
import { Tabs, Tab, TextField, Tooltip, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import Grid from '@mui/material/Grid2';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import DataObjectIcon from '@mui/icons-material/DataObject';
import ListAltIcon from '@mui/icons-material/ListAlt';

const paramUsername = new URLSearchParams(window.location.search).get('username') || 'your_username_here.bsky.social';

// APIS:
// Get DID: https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${username}
// Get Profile: https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${username|did}
// Get Blocklist: https://api.clearsky.services/api/v1/anon/single-blocklist/${did}/${page}
// Get User's Lists: https://public.api.bsky.app/xrpc/app.bsky.graph.getLists?actor=did:plc:jyfkclsce5jemyvrgkxywsdy
// Get List & Items: https://public.api.bsky.app/xrpc/app.bsky.graph.getList?list=at://did:plc:6rah3qput4aol2iu2ecaglhm/app.bsky.graph.list/3lb5o7l3g3j2g&limit=100
//        Next page: https://public.api.bsky.app/xrpc/app.bsky.graph.getList?list=at://did:plc:jyfkclsce5jemyvrgkxywsdy/app.bsky.graph.list/3lc4puz3frp27&limit=100&cursor=3lc53bwv44i2x

function getUserDisplay(item, extra) {
  return (
    <Grid container spacing={1}>
      {item?.avatar && (
        <Grid>
          <a href={`https://bsky.app/profile/${item?.handle && item.handle !== 'USER NOT FOUND' ? item.handle : item.did}`} target="_blank" rel="noreferrer">
            <img
              src={item.avatar}
              alt="avatar"
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                marginRight: '10px',
              }}
            />
          </a>
        </Grid>
      )}
      <Grid>
        {item?.displayName ? <div>{item?.displayName}</div> : ''}
        <a href={`?username=${item?.handle && item.handle !== 'USER NOT FOUND' ? item.handle : item.did}`}>{item?.handle || item.did}</a> <br />
        <Tooltip arrow title="View their block & list count">
          <a href={`?username=${item?.handle && item.handle !== 'USER NOT FOUND' ? item.handle : item.did}`}>
            <PersonOffIcon fontSize="small" />
          </a>
        </Tooltip>{' '}
        <Tooltip arrow title="View their social profile on BlueSky. Right click and chose Private/Incognito Window if you are blocked.">
          <a href={`https://bsky.app/profile/${item?.handle && item.handle !== 'USER NOT FOUND' ? item.handle : item.did}`} target="_blank" rel="noreferrer">
            <img src="https://bsky.app/static/favicon-16x16.png" alt="BlueSky" />
          </a>
        </Tooltip>{' '}
        <Tooltip arrow title="View who they are blocking on ClearSky.app">
          <a href={`https://clearsky.app/${item?.handle && item.handle !== 'USER NOT FOUND' ? item.handle : item.did}`} target="_blank" rel="noreferrer">
            <img src="https://clearsky.app/favicon.ico" alt="ClearSky" style={{ width: '16px', height: '16px' }} />
          </a>
        </Tooltip>
        <Tooltip arrow title="View user's profile from BlueSky API">
          <a
            href={`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${item.did}`}
            target="_blank"
            rel="noreferrer"
            style={{ verticalAlign: 'middle', paddingLeft: '2px' }}
          >
            <DataObjectIcon sx={{ width: '16px' }} />
          </a>
        </Tooltip>
        {extra}
      </Grid>
    </Grid>
  );
}

function App() {
  const [username, setUsername] = useState(paramUsername);
  const [userProfile, setUserProfile] = useState(null);
  const [error, setError] = useState(null);

  const [blockersAndListers, setBlockersAndListers] = useState(new Map());

  const [blockPage, setBlockPage] = useState(1);
  const [allBlockersFetched, setAllBlockersFetched] = useState(false);

  const [listPage, setListPage] = useState(1);
  const [allListsFetched, setAllListsFetched] = useState(false);

  const [editingUsername, setEditingUsername] = useState(false);

  const [fetchingProfiles, setFetchingProfiles] = useState(false);
  const [lastProfileFetched, setLastProfileFetched] = useState('');

  const [tabValue, setTabValue] = useState(0);

  const [userLists, setUserLists] = useState({});
  const [fetchingUserLists, setFetchingUserLists] = useState(false);
  const [purpose, setPurpose] = useState('all');
  const [blockingCount, setBlockingCount] = useState(0);

  useEffect(() => {
    if (username !== paramUsername && !editingUsername) {
      const params = new URLSearchParams(window.location.search);
      params.set('username', username);
      window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
      window.location.reload();
    }
  }, [username, editingUsername]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        // Fetch the DID
        const profileResponse = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${username}`);
        if (profileResponse.status !== 200) {
          setError('User not found');
          return;
        }
        setUserProfile(await profileResponse.json());
      } catch (error) {
        setError(error.message);
      }
    };

    const redirectToUsername = async () => {
      try {
        const profileResponse = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${username}`);
        if (profileResponse.status !== 200) {
          setError('Profile not found');
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
    };

    if (username && !editingUsername) {
      if (username.startsWith('did:')) {
        redirectToUsername();
      } else if (username !== 'your_username_here.bsky.social') {
        fetchUserProfile();
      }
    }
  }, [username, editingUsername]);

  useEffect(() => {
    const fetchPagedBlockList = async (username) => {
      try {
        // Fetch blocklist data until the blocklist array count is less than 100
        const url = `https://api.clearsky.services/api/v1/anon/single-blocklist/${userProfile.did}${blockPage > 1 ? `/${blockPage}` : ''}`;
        let attempts = 0;
        let blocklistResponse;
        while (attempts < 10) {
          blocklistResponse = await fetch(url);
          if (blocklistResponse.status === 200) {
            break;
          }
          console.log(`Trying block page ${blockPage} again...`);
          attempts++;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        if (blocklistResponse.status !== 200) {
          throw new Error('Failed to fetch blocklist data after 10 attempts');
        }
        const blocklistData = await blocklistResponse.json();
        blocklistData.data.blocklist.forEach((blocked) => {
          setBlockersAndListers((prev) => {
            const updatedMap = new Map(prev);
            if (!updatedMap.has(blocked.did)) {
              updatedMap.set(blocked.did, { did: blocked.did, lists: [], blocked: null });
            }
            updatedMap.get(blocked.did).blocked = blocked;
            return updatedMap;
          });
        });
        setAllBlockersFetched(blocklistData.data.blocklist.length < 100);
        setBlockPage((prev) => prev + 1);
      } catch (error) {
        setError(error.message);
      }
    };

    if (userProfile && !allBlockersFetched && !editingUsername) {
      fetchPagedBlockList();
    }
  }, [userProfile, blockPage, allBlockersFetched, editingUsername]);

  useEffect(() => {
    const fetchPagedLists = async (username) => {
      try {
        // Fetch lists data until the lists array count is less than 100
        const url = `https://api.clearsky.services/api/v1/anon/get-list/${userProfile.did}${listPage > 1 ? `/${listPage}` : ''}`;
        let attempts = 0;
        let listResponse;
        while (attempts < 10) {
          listResponse = await fetch(url);
          if (listResponse.status === 200) {
            break;
          }
          console.log(`Trying list page ${listPage} again...`);
          await new Promise((resolve) => setTimeout(resolve, 100));
          attempts++;
        }
        if (listResponse.status !== 200) {
          throw new Error('Failed to fetch list data after 10 attempts');
        }
        const listData = await listResponse.json();
        const lists = listData.data.lists;
        setBlockersAndListers((prev) => {
          const updatedMap = new Map(prev);
          for (const list of lists) {
            if (!updatedMap.has(list.did)) {
              updatedMap.set(list.did, { did: list.did, lists: [], blocked: null });
            }
            const existingLists = updatedMap.get(list.did).lists;
            if (!existingLists.some((existingList) => existingList.url === list.url)) {
              existingLists.push(list);
            }
            if (!updatedMap.get(list.did).blocked && list?.purpose?.endsWith('#modlist')) {
              updatedMap.get(list.did).blocked = { blocked_date: list.date_added, did: list.did };
            }
            if (list.creator && (!updatedMap.get(list.did).handle || updatedMap.get(list.did).handle === 'USER NOT FOUND')) {
              updatedMap.set(list.did, { ...updatedMap.get(list.did), ...list.creator });
            }
          }
          return updatedMap;
        });
        setAllListsFetched(listData.data.lists.length < 100);
        setListPage((prev) => prev + 1);
      } catch (error) {
        setError(error.message);
      }
    };

    if (userProfile && !allListsFetched && !editingUsername) {
      fetchPagedLists();
    }
  }, [userProfile, listPage, allListsFetched, editingUsername]);

  useEffect(() => {
    const fetchUserLists = async () => {
      for (const [did, obj] of blockersAndListers) {
        if (obj.lists.length === 0) {
          continue;
        }
        try {
          const url = `https://public.api.bsky.app/xrpc/app.bsky.graph.getLists?actor=${did}`;
          const getListsResponse = await fetch(url);
          const getListData = await getListsResponse.json();

          const url2 = `https://public.api.bsky.app/xrpc/app.bsky.graph.getActorStarterPacks?actor=${did}`;
          const getStarterPacksResponse = await fetch(url2);
          const getStarterPacksData = await getStarterPacksResponse.json();
          getStarterPacksData.starterPacks.forEach((starterpack) => {
            starterpack.purpose = 'app.bsky.graph.defs#starterpack';
            starterpack.createdAt = starterpack.record.createdAt;
            starterpack.name = starterpack.record.name;
            starterpack.description = starterpack.record.description;
            starterpack.did = starterpack.creator.did;
          });
          setUserLists((prev) => ({ ...prev, [did]: [...getListData.lists, ...getStarterPacksData.starterPacks] }));
        } catch (error) {
          console.error(`Failed to fetch user's lists for DID: ${did}`);
        }
      }
    };

    if (!editingUsername && allListsFetched && blockersAndListers.size && !fetchingUserLists) {
      setFetchingUserLists(true);
      fetchUserLists();
    }
  }, [blockersAndListers, allListsFetched, editingUsername, fetchingUserLists]);

  useEffect(() => {
    const addListInfo = async (username) => {
      setBlockersAndListers((prev) => {
        const updatedMap = new Map(prev);
        for (const [did, obj] of updatedMap) {
          if (userLists[did] && obj.lists.length > 0) {
            const uLists = userLists[did];
            if (uLists && uLists.length > 0) {
              obj.lists.forEach((existingList, index) => {
                const userList = uLists.find((list) => list.name === existingList.name);
                if (userList) {
                  if (userList.uri.includes('starterpack')) {
                    userList.url = userList.uri.replace('at://', 'https://bsky.app/starter-pack/').replace('/app.bsky.graph.starterpack', '');
                  } else {
                    userList.url = userList.uri.replace('at://', 'https://bsky.app/profile/').replace('app.bsky.graph.list', 'lists');
                  }
                  obj.lists[index] = { ...existingList, ...userList };
                }
              });
            }
          }
        }
        return updatedMap;
      });
    };

    if (Object.keys(userLists).length && !editingUsername) {
      addListInfo();
    }
  }, [userLists, editingUsername]);

  useEffect(() => {
    const fetchProfiles = async () => {
      const dids = [];
      for (const obj of blockersAndListers.values()) {
        if (!obj.handle) {
          dids.push(obj.did);
          if (dids.length >= 25) {
            break;
          }
        }
      }
      if (!dids.length) {
        setFetchingProfiles(false);
        return;
      }
      try {
        const params = new URLSearchParams();
        dids.forEach((did) => params.append('actors', did));
        const url = `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfiles?${params.toString()}`;
        const profilesResponse = await fetch(url);
        const profilesData = await profilesResponse.json();
        setBlockersAndListers((prev) => {
          const updatedMap = new Map(prev);
          profilesData.profiles.forEach((profile) => {
            updatedMap.set(profile.did, { ...updatedMap.get(profile.did), ...profile });
          });
          dids.forEach((did) => {
            if (!updatedMap.get(did).handle) {
              updatedMap.set(did, { ...updatedMap.get(did), handle: 'USER NOT FOUND' });
            }
          });
          return updatedMap;
        });
      } catch (error) {
        console.error(`Failed to fetch profiles for DIDs: ${dids.join(', ')}`);
      }
      setLastProfileFetched(dids[dids.length - 1]);
      setFetchingProfiles(false);
    };

    if (!fetchingProfiles && blockersAndListers.size && (!lastProfileFetched || lastProfileFetched !== Array.from(blockersAndListers.keys()).pop())) {
      setFetchingProfiles(true);
      fetchProfiles();
    }
  }, [blockersAndListers, fetchingProfiles, lastProfileFetched]);

  useEffect(() => {
    const fetchBlockingCount = async () => {
      try {
        const response = await fetch(`https://api.clearsky.services/api/v1/anon/blocklist/total/${userProfile.did}`);
        if (response.status === 200) {
          const responseData = await response.json();
          setBlockingCount(responseData.data.count);
        } else {
          console.error('Failed to fetch blocking count');
        }
      } catch (error) {
        console.error('Error fetching blocking count:', error);
      }
    };

    if (userProfile && !editingUsername) {
      fetchBlockingCount();
    }
}, [userProfile, editingUsername]);

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

  const lists = Array.from(blockersAndListers.values())
    .filter((item) => item.lists.length > 0)
    .flatMap((item) => item.lists);
  const blocks = Array.from(blockersAndListers.values()).filter((item) => item.blocked !== null);
  const listInfo = {
    all: {
      name: 'All Lists',
      count: lists.length,
    },
    modlist: {
      name: 'Mute/Block Lists',
      count: lists.filter((list) => list.purpose?.endsWith('#modlist')).length,
    },
    curatelist: {
      name: 'Curate Lists',
      count: lists.filter((list) => list.purpose?.endsWith('#curatelist')).length,
    },
    starterpack: {
      name: 'Starter Packs',
      count: lists.filter((list) => list.purpose?.endsWith('#starterpack')).length,
    },
    other: {
      name: 'Other Lists',
      count: lists.filter((list) => !['modlist', 'curatelist', 'starterpack'].includes(list.purpose?.split('#')[1])).length,
    },
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>
          <PersonOffIcon /> BlueSky Block Count <PersonOffIcon />
        </h1>
        <Grid container spacing={2}>
          <Grid>
            {userProfile?.avatar ? (
              <a href={`https://bsky.app/profile/${userProfile.handle}`} target="_blank" rel="noreferrer">
                <img
                  src={userProfile.avatar}
                  alt="avatar"
                  style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    marginRight: '10px',
                  }}
                />
              </a>
            ) : (
              <a href="/">
                <PersonOffIcon
                  style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    marginRight: '10px',
                    backgroundColor: 'gray',
                  }}
                />
              </a>
            )}
          </Grid>
          <Grid sx={{ minWidth: '280px' }}>
            <div>{userProfile?.displayName}</div>
            {editingUsername ? (
              <TextField
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onBlur={() => setEditingUsername(false)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    setEditingUsername(false);
                  }
                }}
                fullWidth
                sx={{ input: { color: 'white', fontWeight: 'bold' } }}
                style={{ display: 'inline' }}
              />
            ) : (
              <span style={{ color: 'white', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setEditingUsername(true)}>
                {username}
              </span>
            )}
            <div>
              <Tooltip arrow title="View user's social profile on BlueSky">
                <a href={`https://bsky.app/profile/${username}`} target="_blank" rel="noreferrer">
                  <img src="/bsky.png" width="16" height="16" alt="BlueSky" />
                </a>
              </Tooltip>{' '}
              <Tooltip arrow title="View who this user on ClearSky.app">
                <a href={`https://clearsky.app/${username}`} target="_blank" rel="noreferrer">
                  <img src="https://clearsky.app/favicon.ico" alt="ClearSky" style={{ width: '16px', height: '16px' }} />
                </a>
              </Tooltip>
              <Tooltip arrow title="View this user's profile from BlueSky API">
                <a
                  href={`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${username}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ verticalAlign: 'middle', paddingLeft: '2px' }}
                >
                  <DataObjectIcon sx={{ width: '16px' }} />
                </a>
              </Tooltip>
              <div style={{fontSize: '0.6em'}}>{userProfile ? <><a href={`https://bsky.app/profile/${username}/followers`} target="_blank" rel="noreferrer" style={{color: "inherit", textDecoration: 'none'}}><span style={{fotWeight: 'bold'}}>{userProfile.followersCount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</span> followers</a>, <a href={`https://bsky.app/profile/${username}/follows`} target="_blank" rel="noreferrer" style={{color: "inherit", textDecoration: 'none'}}><span style={{fotWeight: 'bold'}}>{userProfile.followsCount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</span> following</a>, <a href={`https://clearsky.app/${username}/blocking`} target="_blank" rel="noreferrer" style={{color: "inherit", textDecoration: 'none'}}><span style={{fotWeight: 'bold'}}>{blockingCount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</span> blocking</a></> : ''}</div>
            </div>
          </Grid>
        </Grid>
        {error ? <p>Error: {error}</p> : ''}
        <div style={{ paddingTop: '10px' }}>
          {!error && !editingUsername && (!allBlockersFetched || !allListsFetched) && username !== 'your_username_here.bsky.social' && (
            <CircularProgress size={30} style={{ color: 'white' }} />
          )}
        </div>
      </header>
      <div>
        <Tabs value={tabValue} onChange={handleTabChange} centered>
          <Tab label={`Blocked By (${blocks.length})`} sx={{ fontSize: '1.2em', fontWeight: 'bold' }} />
          <Tab label={`${listInfo[purpose].name} (${listInfo[purpose].count})`} sx={{ fontSize: '1.2em', fontWeight: 'bold' }} />
        </Tabs>
        {tabValue === 0 && (
          <table className="responsive-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Blocked By</th>
                <th>When</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {blocks
                .sort((a, b) => new Date(b.blocked.blocked_date) - new Date(a.blocked.blocked_date))
                .map((item, index) => (
                  <tr key={index}>
                    <td data-label="#">{index + 1}</td>
                    <td data-label="Blocked By" style={{ textAlign: 'left', minWidth: '300px' }}>
                      {getUserDisplay(item, item.lists.length > 0 && (<div style={{ marginTop: '10px', backgroundColor: 'red', 'color': 'white', textAlign: 'center' }}>also has user on a list</div>))}
                    </td>
                    <td data-label="When">
                      <Tooltip arrow title={item.blocked.blocked_date?.split('.')[0].replace('T', ' ')}>
                        {getRelativeTime(item.blocked?.blocked_date)}
                      </Tooltip>
                    </td>
                    <td data-label="Description">{item?.description || <>&nbsp;</>}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
        {tabValue === 1 && (
          <>
            <Grid container spacing={2} justifyContent="center" style={{ marginBottom: '20px', paddingTop: '20px' }}>
              <Grid item>
                <FormControl variant="outlined" sx={{ minWidth: 200 }}>
                  <InputLabel>List Type</InputLabel>
                  <Select value={purpose} onChange={(e) => setPurpose(e.target.value)} label="Purpose">
                    <MenuItem value="all">{listInfo.all.name} ({listInfo.all.count})</MenuItem>
                    <MenuItem value="modlist">{listInfo.modlist.name} ({listInfo.modlist.count})</MenuItem>
                    <MenuItem value="curatelist">{listInfo.curatelist.name} ({listInfo.curatelist.count})</MenuItem>
                    <MenuItem value="starterpack">{listInfo.starterpack.name} ({listInfo.starterpack.count})</MenuItem>
                    <MenuItem value="other">{listInfo.other.name} ({listInfo.other.count})</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <table className="responsive-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>List Name</th>
                  <th>Creator</th>
                  <th>Purpose</th>
                  <th>Description</th>
                  <th>Added</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {lists
                  .filter((list) => list.purpose?.endsWith(`#${purpose}`) || purpose === 'all' || (purpose === 'other' && !['curatelist', 'modlist', 'starterpack'].includes(list.purpose?.split('#')[1])))
                  .sort((a, b) => new Date(b.date_added) - new Date(a.date_added))
                  .map((list, index) => {
                    const item = blockersAndListers.get(list.did);
                    return (
                      <tr key={index}>
                        <td data-label="#">{index + 1}</td>
                        <td data-label="List Name" style={{ textAlign: 'left' }}>
                          <Tooltip arrow title="View the list on BlueSky. Right click and chose Private/Incognito Window if you are blocked.">
                            <a href={list.url} target="_blank" rel="noreferrer">
                              {list.name}
                            </a>
                          </Tooltip>
                          <div>
                            <Tooltip arrow title="View the list on BlueSky. Right click and chose Private/Incognito Window if you are blocked.">
                              <a href={list.url} target="_blank" rel="noreferrer">
                                <img src="https://bsky.app/static/favicon-16x16.png" alt="BlueSky" />
                              </a>
                            </Tooltip>
                            {list.uri && (
                              <Tooltip
                                arrow
                                title='API data of the list, including blocked users. Add &cursor=<cursor> to the end, <cursor> being the value of \"cursor\" in the previous response.'
                              >
                                <a
                                  href={
                                    list.purpose?.endsWith('starterpack')
                                      ? `https://public.api.bsky.app/xrpc/app.bsky.graph.getStarterPack?starterPack=${list.uri}`
                                      : `https://public.api.bsky.app/xrpc/app.bsky.graph.getList?list=${list.uri}&limit=100`
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ width: '16px', verticalAlign: 'middle' }}
                                >
                                  <DataObjectIcon sx={{ width: '16px' }} />
                                </a>
                              </Tooltip>
                            )}
                          </div>
                        </td>
                        <td data-label="Creator" style={{ textAlign: 'left', minWidth: '300px' }}>
                          {getUserDisplay(
                            item,
                            <>
                              <Tooltip arrow title="View ALL their lists from the API (JSON)">
                                <a
                                  href={`https://public.api.bsky.app/xrpc/app.bsky.graph.getLists?actor=${item.did}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ verticalAlign: 'middle', paddingLeft: '2px' }}
                                >
                                  <ListAltIcon sx={{ width: '16px' }} />
                                </a>
                              </Tooltip>
                              <Tooltip arrow title="View their starter packs from the API (JSON)">
                                <a
                                  href={`https://public.api.bsky.app/xrpc/app.bsky.graph.getActorStarterPacks?actor=${item.did}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ verticalAlign: 'middle', paddingLeft: '2px' }}
                                >
                                  <ListAltIcon sx={{ width: '16px' }} />
                                </a>
                              </Tooltip>
                            </>
                          )}
                        </td>
                        <td data-lable="Purpose">
                          {list.purpose?.split('#')[1] === 'modlist'
                            ? 'mute/block'
                            : list.purpose?.split('#')[1] === 'curatelist'
                            ? 'curate'
                            : list.purpose?.split('#')[1]
                            ? list.purpose?.split('#')[1]
                            : '???'}
                        </td>
                        <td data-label="Description">{list.description || ''}</td>
                        <td data-label="Added">
                          <Tooltip arrow title={list.date_added.split('.')[0].replace('T', ' ')}>
                            {getRelativeTime(list.date_added)}
                          </Tooltip>
                        </td>
                        <td data-label="Created">
                          <Tooltip arrow title={list.created_date.split('.')[0].replace('T', ' ')}>
                            {getRelativeTime(list.created_date)}
                          </Tooltip>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
