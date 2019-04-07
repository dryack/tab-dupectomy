chrome.browserAction.onClicked.addListener(closeDuplicateTabsInAllWindows);
chrome.tabs.onUpdated.addListener(countDuplicateSiblings);
chrome.tabs.onRemoved.addListener(countDuplicateSiblingsOnRemoved);

const MURMUR3_SEED = 1717;

function closeDuplicateTabsInAllWindows()
{
    chrome.windows.getAll(
    {
        "populate": true,
        "windowTypes": ["normal"]
    }, closeDuplicateTabs);
}

function countDuplicateSiblings(tabId, changeInfo)
{
   if (changeInfo.status === 'complete')
   {
      chrome.windows.getAll(
      {
          "populate": true,
          "windowTypes": ["normal"]
      }, countDuplicateTabs);
   }
}

function countDuplicateSiblingsOnRemoved()
{
    chrome.windows.getAll(
    {
        "populate": true,
        "windowTypes": ["normal"]
    }, countDuplicateTabs);
}

function closeDuplicateTabs(windows)
{
    let tabs = [];
    for (let index in windows)
    {
        tabs.push(windows[index].tabs)
    }
   processDuplicates(tabs, new Closer());
   updateDisplay(new Display());
}

function countDuplicateTabs(windows)
{
    let tabs = [];
    for (let index in windows)
    {
        tabs.push(windows[index].tabs)
    }

    tabsObj = [];
    for (let tIndex in tabs)
    {
        tabsObj.push(tabs[tIndex].map(function(tab)
            {
                return [murmurhash3_32_gc((tab.title + tab.url), MURMUR3_SEED), [tab.windowId, tab.title, tab.url]];
            }
        ));
    }

    console.log(tabsObj);

    const counter = new Counter();
    processDuplicates(tabs, counter);
    updateDisplay(new Display(counter));
}

function processDuplicates(tabs, implementation)
{
   const processor = new DuplicateProcessor(implementation);

   for (let index in tabs)
   {
       for (let jIndex = 0; jIndex < tabs[index].length; jIndex++)
       {
           processor.process(tabs[index][jIndex]);
       }
   }
}

function updateDisplay(display)
{
   chrome.browserAction.setBadgeText({text: display.text});
   chrome.browserAction.setTitle({title: display.title});
}

function DuplicateProcessor(implementation)
{
   this.cache = new TabCache();
   this.process = function(tab)
   {
       const found = this.cache.exists(tab);

       if (found)
       {
           implementation.execute(this.nonSelected(found, tab));
       } else {
           this.cache.remember(tab);
       }
   };
   
   this.nonSelected = function(found, tab)
   {
      if (!found.selected)
      {
         this.cache.remember(tab);
         return found;
      }
    
      if (!tab.selected)
      {
         return tab;
      }

    // this seems to work just fine, but does seem quite right
    return tab;
   };
}

function Counter()
{
   this.count = 0;
   this.urls = "";
   this.execute = function(tab)
   {
       this.count += 1;
       this.urls += tab.url + '\n';
   };
}

function Closer()
{
   this.execute = function(tab)
   {
      chrome.tabs.remove(tab.id);
   };
}

function TabCache()
{
   this.tabs = [];
   
   this.exists = function(tab)
   {
      return this.tabs[tab.url.toLowerCase()];
   };
   
   this.remember = function(tab)
   {
      this.tabs[tab.url.toLowerCase()] = tab;
   };
}

function Display(counter)
{
   if (!counter)
   {
      this.title = "";
      this.text = "";
      return
   }

   this.title = counter.urls;
   this.text = "";

   if (counter.count !== 0)
   {
      this.text = counter.count + '';
   }
}

/**
 * JS Implementation of MurmurHash3 (r136) (as of May 20, 2011)
 *
 * @author <a href="mailto:gary.court@gmail.com">Gary Court</a>
 * @see http://github.com/garycourt/murmurhash-js
 * @author <a href="mailto:aappleby@gmail.com">Austin Appleby</a>
 * @see http://sites.google.com/site/murmurhash/
 *
 * @param {string} key ASCII only
 * @param {number} seed Positive integer only
 * @return {number} 32-bit positive integer hash
 */

function murmurhash3_32_gc(key, seed) {
   let remainder, bytes, h1, h1b, c1, c1b, c2, c2b, k1, i;

   remainder = key.length & 3; // key.length % 4
   bytes = key.length - remainder;
   h1 = seed;
   c1 = 0xcc9e2d51;
   c2 = 0x1b873593;
   i = 0;

   while (i < bytes) {
      k1 =
          ((key.charCodeAt(i) & 0xff)) |
          ((key.charCodeAt(++i) & 0xff) << 8) |
          ((key.charCodeAt(++i) & 0xff) << 16) |
          ((key.charCodeAt(++i) & 0xff) << 24);
      ++i;

      k1 = ((((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16))) & 0xffffffff;
      k1 = (k1 << 15) | (k1 >>> 17);
      k1 = ((((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16))) & 0xffffffff;

      h1 ^= k1;
      h1 = (h1 << 13) | (h1 >>> 19);
      h1b = ((((h1 & 0xffff) * 5) + ((((h1 >>> 16) * 5) & 0xffff) << 16))) & 0xffffffff;
      h1 = (((h1b & 0xffff) + 0x6b64) + ((((h1b >>> 16) + 0xe654) & 0xffff) << 16));
   }

   k1 = 0;

   switch (remainder) {
      case 3:
         k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
      case 2:
         k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
      case 1:
         k1 ^= (key.charCodeAt(i) & 0xff);

         k1 = (((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
         k1 = (k1 << 15) | (k1 >>> 17);
         k1 = (((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;
         h1 ^= k1;
   }

   h1 ^= key.length;

   h1 ^= h1 >>> 16;
   h1 = (((h1 & 0xffff) * 0x85ebca6b) + ((((h1 >>> 16) * 0x85ebca6b) & 0xffff) << 16)) & 0xffffffff;
   h1 ^= h1 >>> 13;
   h1 = ((((h1 & 0xffff) * 0xc2b2ae35) + ((((h1 >>> 16) * 0xc2b2ae35) & 0xffff) << 16))) & 0xffffffff;
   h1 ^= h1 >>> 16;

   return h1 >>> 0;
}