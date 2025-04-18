// HELPER FUNCTIONS


chrome.storage.sync.get(
    { favoriteColor: 'red', likesColor: true, option3: false },
    (items) => {
      console.log("--- fav color 1b ---");
      //document.getElementById('color').value = items.favoriteColor;
      //document.getElementById('like').checked = items.likesColor;
      console.log("--- fav color 2 ---");
      console.log(items.favoriteColor);
      console.log(items.likesColor);
      console.log(items.option3);
    }
  );



// get urls from Jira ticket
function getAllLink(){
  var linkedclass = document.getElementsByClassName('css-u92d69');
  var class_descr = document.getElementsByClassName('fiVZLH');
  var class_comments = document.getElementsByClassName('eeajecn0');
  var class_mentioned = document.getElementsByClassName('sc-1lvfme5-2');

  // notion
  var notionurls = document.getElementsByClassName('notion-link-token'); //notion-focusable-token notion-enable-hover

  var array1 = [];

  for(i=0;i<notionurls.length;i++){
    var str = notionurls[i].href;
    var res = str.split("?"); 
    array1.push(res[0]);
}
  
  for(i=0;i<linkedclass.length;i++){
    var str = linkedclass[i].href;
    var res = str.split("?"); 
    array1.push(res[0]);
}

  for(i=0;i<class_descr.length;i++){
      var str = class_descr[i].href;
      var res = str.split("?"); 
      array1.push(res[0]);
  }

  for(i=0;i<class_comments.length;i++){
    var str = class_comments[i].href;
    var res = str.split("?"); 
    array1.push(res[0]);
  }


  for(i=0;i<class_mentioned.length;i++){
    var str = class_mentioned[i].href;
    var res = str.split("?"); 
    array1.push(res[0]);
  }


  console.log('urls', array1);
  return array1;
}




function ticketFullScreen(){

// SCRIPT STARTS HERE 

// get current tab 
chrome.tabs.query({
  active: true,
  currentWindow: true
}, function(tabs) {
  cid = tabs[0].id;
  ctitle = tabs[0].title;

    // create new group for current tab
    chrome.tabs.group({
      tabIds: [cid]
    }, function(newgroupid) {
      
      // rename group 
      chrome.tabGroups.update(newgroupid, {
        title: ctitle
      }, function(updategroups){
          
        // get all urls from current tab (see Jira helper function)
    chrome.scripting.executeScript({
      target: {tabId: cid},
      function: getAllLink,
      args: ['Hello']
  }, function(xxx) {

    // loop over all urls
          var urls = xxx[0]['result']
          for (let i = 0; i < urls.length; i++) {
            console.log('url', i, urls[i]);

            // create tabs and add to group
            chrome.tabs.create({url: urls[i], active: false}, createdTab => {
              chrome.tabs.onUpdated.addListener(function _(tabId, info, tab) {
                if (tabId === createdTab.id && info.url) {
                  chrome.tabs.onUpdated.removeListener(_);
                  chrome.tabs.group({
                    groupId: newgroupid,
                    tabIds: [tabId]
                  }, function(xxx) {}
              )};
              });
            });

          }

      });
        
    });

    

    });
});
}


function getTitleSide(){
  var xtitle = document.getElementsByClassName('css-oj2grg')[3].textContent;
  // console.log(xtitle_list);
  // backlog in url = -2
  // sonst -4
  // var xtitle = xtitle_list[xtitle_list.length - 2].textContent;
  var ytitle = document.getElementsByClassName('sc-1rgscgt-0')[0].textContent;
  var final = '['.concat(xtitle,']',' ',ytitle);
  return final;
}


function ticketSide(){
  
  // get current tab 
  chrome.tabs.query({
    active: true,
    currentWindow: true
  }, function(tabs) {
    cid = tabs[0].id;
    ctitle = tabs[0].title;
    curl = tabs[0].url;
    chrome.scripting.executeScript({
      target: {tabId: cid},
      function: getTitleSide,
      args: ['yyy']
  }, function(yyy) {



      var base = curl.split('/');
      var new_id = yyy[0]['result'].split(']')
      var new_id_2 = new_id[0].replace('[','')

      var new_url = 'https://'.concat(base[2], '/browse/',new_id_2 )


      chrome.tabs.create({url: new_url, active: false}, createdTab => {
        chrome.tabs.onUpdated.addListener(function _(tabId, info, tab) {
          if (tabId === createdTab.id && info.url) {
            chrome.tabs.onUpdated.removeListener(_);
            chrome.tabs.group({
              tabIds: [tabId]
            }, function(xxx) {
       
     


      console.log(new_url)
      // create new group for current tab
      chrome.tabs.group({
        tabIds: [tabId]
      }, function(newgroupid) {
        
        // rename group 
        chrome.tabGroups.update(newgroupid, {
          title: yyy[0]['result']
        }, function(updategroups){
            
          // get all urls from current tab (see Jira helper function)
      chrome.scripting.executeScript({
        target: {tabId: tabId},
        function: getAllLink,
        args: ['Hello']
    }, function(xxx) {
  
      // loop over all urls
            var urls = xxx[0]['result']
            console.log('urls', xxx)
            for (let i = 0; i < urls.length; i++) {
              console.log('url', i, urls[i]);
  
              // create tabs and add to group
              chrome.tabs.create({url: urls[i], active: false}, createdTab => {
                chrome.tabs.onUpdated.addListener(function _(tabId, info, tab) {
                  if (tabId === createdTab.id && info.url) {
                    chrome.tabs.onUpdated.removeListener(_);
                    chrome.tabs.group({
                      groupId: newgroupid,
                      tabIds: [tabId]
                    }, function(xxx) {}
                )};
                });
              });
  
            }
  
        });
          
      });
  
      
  
      });});}; 
    });
  }); 
})})};


// ***

// get urls from Jira ticket
function addComment(){
  var commentbox = document.getElementsByClassName('upcifj-0').value = ('placeholder','My own text...');
  
}

function removeDuplicates(myArray1,myArray2){
  var myFinalArray1 = [...new Set(myArray1)];
  var myFinalArray2 = [...new Set(myArray2)];
  console.log('a1',myFinalArray1);
  console.log('a2',myFinalArray2);
  var myFinalArray = [...new Set([...myFinalArray1 ,...myFinalArray2])]; 
  
  let difference = myFinalArray.filter(x => !myFinalArray1.includes(x));

  console.log('myFinalArray',difference);
  return difference
}
// get urls from Jira ticket
function getAllLink(){

  // jira
  var linkedclass = document.getElementsByClassName('css-u92d69');
  var class_descr = document.getElementsByClassName('fiVZLH');
  var class_comments = document.getElementsByClassName('eeajecn0');
  
  // notion
  var notionurls = document.getElementsByClassName('notion-link-token'); //notion-focusable-token notion-enable-hover

  var array1 = [];

  for(i=0;i<notionurls.length;i++){
    var str = notionurls[i].href;
    var res = str.split("?"); 
    array1.push(res[0]);
}

  for(i=0;i<linkedclass.length;i++){
    var str = linkedclass[i].href;
    var res = str.split("?"); 
    array1.push(res[0]);
}
  
  for(i=0;i<class_descr.length;i++){
      var str = class_descr[i].href;
      var res = str.split("?"); 
      array1.push(res[0]);
  }

  for(i=0;i<class_comments.length;i++){
    var str = class_comments[i].href;
    var res = str.split("?"); 
    array1.push(res[0]);
  }

  console.log('urls', array1);
  return array1;
}

function getUrlsFromTabList(texts){
  var text = [];

  for (let i = 0; i < texts.length; i++) {
    text.push(texts[i]['url']);
  }
  return text
}

function getTitlesFromTabList(texts){
  var text = [];

  for (let i = 0; i < texts.length; i++) {
    text.push(texts[i]['title']);
  }
  return text
}

function copyTextToClipboard(text) {

  


  console.log('tet', text);
  //Create a textbox field where we can insert text to. 
  var copyFrom = document.createElement("textarea");

  // let result = text.replace("/mail/id/", "/mail/deeplink/readconv/");
  // let result2 = result.replace("/mail/inbox/id/", "/mail/deeplink/readconv/");
  // let result3 = result2.replace("/mail/sentitems/id/", "/mail/deeplink/readconv/");


  //Set the text content to be the text you wished to copy.
  copyFrom.textContent = text.join(" ");

  //Append the textbox field into the body as a child. 
  //"execCommand()" only works when there exists selected text, and the text is inside 
  //document.body (meaning the text is part of a valid rendered HTML element).
  document.body.appendChild(copyFrom);

  //Select all the text!
  copyFrom.select();

  //Execute command
  document.execCommand('copy');

  //(Optional) De-select the text using blur(). 
  copyFrom.blur();

  //Remove the textbox field from the document.body, so no other JavaScript nor 
  //other elements can get access to this.
  document.body.removeChild(copyFrom);

}


//get all tabs in group
function all_in() {
chrome.tabs.query({
  active: true,
  currentWindow: true
}, function(tabs) {
  console.log('active tab', tabs);
  console.log('active group id', tabs[0].groupId);
  var cid = tabs[0].id;

  chrome.tabs.query({
    active: false,
    groupId: tabs[0].groupId
  }, function(tabs) {
    console.log('non-active tab', tabs);

    // get all urls from current tab (see Jira helper function)
    chrome.scripting.executeScript({
      target: {tabId: cid},
      function: getAllLink,
      args: ['Hello']
  }, function(xxx) {

    /// FIND DUPLICATES !!!!!!!!
    copyTextToClipboard(removeDuplicates(xxx[0]['result'], getUrlsFromTabList(tabs)));
    
  });
});
});
}
// ***


console.log('1');

chrome.tabs.query({
  active: true,
  currentWindow: true
}, function(tabs) {

  chrome.tabGroups.query({}, function(tabGroups) {
    console.log('tabgroups', tabGroups);
    
    // I need a function to get the specific full row of array "tabgroups" with the id "123" 
    // and then get the title of this row

    let specificRow = tabGroups.find(row => row.id === tabs[0].groupId);
    console.log(specificRow);


    var tg = tabGroups[0].title;
    console.log('tabgroup 0 title', tg);
  });

  

  ctitle = tabs[0].url;
  cindex = tabs[0].index;
  console.log('active tab', tabs);
  console.log('active group id', tabs[0].groupId);
  
  //if (ctitle.includes("Agile")) {
  //  console.log('Fire Side');
  //  ticketSide();
  //} else {
  //  console.log('Fire Full');
  //  ticketFullScreen();
  //}

  if (tabs && tabs.length > 0 && tabs[0].groupId === -1) {
    ticketFullScreen(); 
} else {

  console.log('ctitle', ctitle);
  if (ctitle.includes("notion.so")) {
    console.log('Fire Notion');
    all_in();

  } else {
    // open Notion
    // create tabs and add to group
    chrome.tabs.create({url: "https://www.notion.so/new", active: false}, createdTab => {
      chrome.tabs.onUpdated.addListener(function _(tabId, info, tab) {
        console.log('cindex', cindex);
        console.log('cindex-1', cindex-1);
        chrome.tabs.move(tabId, {index: cindex-1});
        if (tabId === createdTab.id && info.url) {
          chrome.tabs.onUpdated.removeListener(_);
          chrome.tabs.group({
            groupId: tabs[0].groupId,
            tabIds: [tabId]
          }, function(xxx) {}
      )};
      
      });
      all_in();
    });

    
    }

    
}


});
