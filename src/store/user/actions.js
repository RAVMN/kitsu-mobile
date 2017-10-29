import { LoginManager, GraphRequest, GraphRequestManager } from 'react-native-fbsdk';
import * as types from 'kitsu/store/types';
import { Kitsu, setToken } from 'kitsu/config/api';
import { loginUser } from 'kitsu/store/auth/actions';

export const fetchCurrentUser = () => async (dispatch, getState) => {
  dispatch({ type: types.FETCH_CURRENT_USER });
  const token = getState().auth.tokens.access_token;
  setToken(token);
  try {
    const user = await Kitsu.findAll('users', {
      fields: {
        users:
          'id,name,createdAt,email,avatar,coverImage,about,ratingSystem,shareToGlobal,sfwFilter,ratingSystem,facebookId,titleLanguagePreference,status',
      },
      filter: { self: true },
    });
    dispatch({ type: types.FETCH_CURRENT_USER_SUCCESS, payload: user[0] });
    createOneSignalPlayer(dispatch, getState);
  } catch (e) {
    dispatch({ type: types.FETCH_CURRENT_USER_FAIL, payload: 'Failed to load user' });
  }
};

export const createUser = (data, nav) => async (dispatch, getState) => {
  dispatch({ type: types.CREATE_USER });
  const { username, email, password, birthday } = data;
  const { id, gender } = getState().auth.fbuser;
  const userObj = {
    name: username,
    email,
    password,
    birthday,
  };

  if (id) {
    userObj.facebookId = id;
    userObj.gender = gender;
  }
  try {
    await Kitsu.create('users', userObj);
    loginUser(data, nav)(dispatch);

    // TODO: Add user object to redux
    dispatch({ type: types.CREATE_USER_SUCCESS, payload: {} });
    dispatch({ type: types.CLEAR_FBUSER });
  } catch (e) {
    dispatch({ type: types.CREATE_USER_FAIL, payload: e });
  }
};

export const connectFBUser = () => async (dispatch, getState) => {
  dispatch({ type: types.CONNECT_FBUSER });
  const infoRequest = new GraphRequest(
    '/me',
    {
      httpMethod: 'GET',
      version: 'v2.5',
      parameters: {
        fields: {
          string: 'email, name, gender',
        },
      },
    },
    async (error, fbdata) => {
      if (!error) {
        const token = getState().auth.tokens.access_token;
        const currentUser = getState().user.currentUser;
        setToken(token);
        try {
          await Kitsu.update('users', { id: currentUser.id, facebookId: fbdata.id });
          dispatch({ type: types.CONNECT_FBUSER_SUCCESS, payload: fbdata.id });
        } catch (e) {
          dispatch({ type: types.CONNECT_FBUSER_FAIL, payload: 'Failed to connect Facebook user' });
          console.log(e);
        }
      } else {
        console.log(error);
        dispatch({ type: types.CONNECT_FBUSER_FAIL, payload: 'Failed to connect Facebook user' });
      }
    },
  );
  new GraphRequestManager().addRequest(infoRequest).start();
};

export const disconnectFBUser = () => async (dispatch, getState) => {
  dispatch({ type: types.DISCONNECT_FBUSER });
  const token = getState().auth.tokens.access_token;
  const currentUser = getState().user.currentUser;
  setToken(token);
  try {
    await Kitsu.update('users', { id: currentUser.id, facebookId: null });
    dispatch({ type: types.DISCONNECT_FBUSER_SUCCESS });
    LoginManager.logOut();
  } catch (e) {
    dispatch({ type: types.DISCONNECT_FBUSER_FAIL, payload: 'Failed to disconnect fb user' });
    console.log(e);
  }
};

export const updateGeneralSettings = data => async (dispatch, getState) => {
  dispatch({ type: types.UPDATE_GENERAL_SETTINGS });
  const { user, auth } = getState();
  const { id } = user.currentUser;
  const token = auth.tokens.access_token;
  setToken(token);
  try {
    // Update everything we have.
    const payload = data;
    await Kitsu.update('users', { id, ...payload });
    delete payload.password; // Don't keep password.
    dispatch({ type: types.UPDATE_GENERAL_SETTINGS_SUCCESS, payload });
  } catch (e) {
    dispatch({ type: types.UPDATE_GENERAL_SETTINGS_FAIL });
  }
};

export const updateLibrarySettings = data => async (dispatch, getState) => {
  dispatch({ type: types.UPDATE_LIBRARY_SETTINGS });
  const { user, auth } = getState();
  const { id } = user.currentUser;
  const { ratingSystem, titleLanguagePreference } = data;
  const token = auth.tokens.access_token;
  setToken(token);
  try {
    await Kitsu.update('users', { id, ratingSystem, titleLanguagePreference });
    dispatch({ type: types.UPDATE_LIBRARY_SETTINGS_SUCCESS, payload: data });
  } catch (e) {
    dispatch({ type: types.UPDATE_LIBRARY_SETTINGS_FAIL });
  }
};

const createOneSignalPlayer = async (dispatch, getState) => {
  const { playerId, playerCreated, currentUser } = getState().user;
  if (!playerCreated) {
    dispatch({ type: types.CREATE_PLAYER });
    try {
      await Kitsu.create('oneSignalPlayers', {
        playerId,
        platform: 'mobile',
        user: currentUser,
      });
      dispatch({ type: types.CREATE_PLAYER_SUCCESS });
    } catch (e) {
      console.log(e);
      dispatch({ type: types.CREATE_PLAYER_FAIL, payload: 'Failed to register notifications' });
    }
  }
};

export const followUser = userId => async (dispatch, getState) => {
  dispatch({ type: types.USER_FOLLOW_REQUEST });

  const { user: { currentUser: { id } } } = getState();
  const data = {
    follower: { id },
    followed: { id: userId },
  };
  try {
    const response = await Kitsu.create('follows', data);
    dispatch({ type: types.USER_FOLLOW_SUCCESS, payload: response });
  } catch (e) {
    dispatch({ type: types.USER_FOLLOW_FAIL, payload: e });
  }
};
