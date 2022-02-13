const axios = require('axios');
const fs = require('fs');
const { join } = require('path');

const { PostsQuery, PostQuery } = require('./query');

class Crawler {
  constructor(username, { delay, cert }) {
    this.username = username; 

    if (!username) {
      console.error('Error: 유저이름을 입력해주세요')
      process.exit(1);
    }

    // options
    this.delay = delay;
    this.cert = cert;

    this.__grahpqlURL = 'https://v2.velog.io/graphql';
    this.__api = axios.create({
      headers:{
        Cookie: cert ? `access_token=${cert};` : null,
      }, 
    });
  }

  async parse() {
    const posts = await this.getPosts();
    
    posts.map(async(postInfo, i) => { 
      if (this.delay > 0) await new Promise(r => setTimeout(r, this.delay * i));

      let post = await this.getPost(postInfo.url_slug);
      post.body = await this.getImage(post.body);

      await this.writePost(post);
    });
  }

  async getPosts() {
    const url = `https://velog.io/@${this.username}`;
    let response;
    let posts = [];

    try {
      await this.__api.get(url);
    } catch (e) {
      if (e.response.status === 404) {
        console.error(`Error: 해당 유저를 찾을 수 없어요 \n username = ${this.username}`);
        process.exit(1);
      }

      console.error("Error");
    }

    while (true) {
      try {
        if (response && response.data.data.posts.length >= 20) {
          response = await this.__api.post(this.__grahpqlURL, PostsQuery(this.username, posts[posts.length - 1].id));
        } else {
          response = await this.__api.post(this.__grahpqlURL, PostsQuery(this.username));
        }
      } catch(e) {
        console.error(`Error:  벨로그에서 글 목록을 가져오는데 실패했습니다. \n error = ${e}`);
        process.exit(1);
      }
      
      posts = [...posts, ...response.data.data.posts];
      if (response.data.data.posts.length < 20) break;
    }
    return posts;
  }

  async getPost(url_slug) {
    let response;

    try {
      response = await this.__api.post(this.__grahpqlURL, PostQuery(this.username, url_slug));
    } catch (e) {
      console.error(`Error:  벨로그에서 글을 가져오는데 실패했습니다. \n error = ${e} url = ${url_slug}`);
      process.exit(1);
    }
    
    return response.data.data.post;
  }

  async writePost(post) {
    const excludedChar = ['\\\\', '/', ':' ,'\\*' ,'\\?' ,'"' ,'<' ,'>' ,'\\|'];
    let title = post.title;

    for (const char of excludedChar) {
      const re = new RegExp(char, 'g');
      title = title.replace(re, '');
    }
    
    console.log(post.title);
    this.tempLine();
    console.log(post.body);
    this.tempLine();
    console.log(post.tags.join(","));
    this.tempLine();
    console.log(post.released_at);
    this.tempLine();
    console.log('&&&&&&end------');
  }

  async getImage(body) {
    const regex = /!\[[^\]]*\]\((.*?.png|.jpeg|.jpg|.webp|.svg|.gif|.tiff)\s*("(?:.*[^"])")?\s*\)|!\[[^\]]*\]\((.*?)\s*("(?:.*[^"])")?\s*\)/g;
    
    body = body.replace(regex, (_, url) => {
      if (!url) return;

      const filename = url.replace(/\/\s*$/,'').split('/').slice(-2).join('-').trim();

      const path = join('media', 'images', decodeURI(this.username+filename));

      if (!fs.existsSync('media/images')){
        fs.mkdirSync('media/images');
    }
      
      this.__api({
        method: 'get',
        url: encodeURI(decodeURI(url)),
        responseType: 'stream',
      })
      .then(resp => resp.data.pipe(fs.createWriteStream(path)))
      .catch(e => console.error(`Error: 이미지를 다운 받는데 오류가 발생했습니다 / url = ${url} , e = ${e}`));

      return `![](/images/${this.username+filename})`;
    });

    return body;
  }

  tempLine() {
    console.log("!@#$%^&*(!*!&@%!$@!&*@%!@$!");
  }

};

module.exports = Crawler;
