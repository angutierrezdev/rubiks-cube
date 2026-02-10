# Progressive Web App (PWA) Guide

This document provides detailed information about the PWA implementation for the Rubik's Cube application.

## Overview

The application is now a fully functional Progressive Web App (PWA) that can be installed on devices and work offline. This implementation follows the pattern used in the `our-house` repository and includes support for both iOS and Android platforms.

## Files Added

### 1. `manifest.json`
The Web App Manifest provides metadata about the application:
- **name**: Full application name displayed during installation
- **short_name**: Short name for home screen
- **description**: Brief description of the app
- **start_url**: URL to load when app is launched
- **display**: `standalone` mode for native app experience
- **background_color**: Splash screen background color
- **theme_color**: Browser UI color
- **icons**: SVG-based Rubik's cube icons (192x192 and 512x512)

### 2. `sw.js` (Service Worker)
The service worker handles caching and offline functionality:
- **VERSION**: Semantic version for cache management
- **CACHE_NAME**: Versioned cache identifier
- **urlsToCache**: List of resources to cache on install
- **Install event**: Caches app shell resources
- **Activate event**: Cleans up old caches and notifies clients
- **Fetch event**: Serves from cache with network fallback
- **Message handler**: Processes update requests

### 3. Updated `index.html`
Added PWA-specific elements:
- Manifest link
- Theme color meta tag
- iOS-specific meta tags:
  - `apple-mobile-web-app-capable`: Enables standalone mode
  - `apple-mobile-web-app-status-bar-style`: Controls status bar appearance
  - `apple-mobile-web-app-title`: App title on iOS
  - `apple-touch-icon`: Icon for iOS home screen
- Service worker registration script
- Update notification system

## Installation Instructions

### Desktop (Chrome, Edge, Brave)

1. Visit the application in a Chromium-based browser
2. Look for the install icon (⊕ or computer icon) in the address bar
3. Click the icon and select "Install" from the prompt
4. The app will be added to your desktop and app drawer

Alternatively:
- Click the menu (⋮) → "Install [App Name]"

### iOS (iPhone/iPad)

1. Open the application in **Safari** (PWA installation only works in Safari on iOS)
2. Tap the Share button (□↑) at the bottom of the screen
3. Scroll down and tap "Add to Home Screen"
4. Edit the name if desired and tap "Add"
5. The app icon will appear on your home screen

**Note**: iOS PWAs have some limitations:
- Service workers have limited cache storage (50MB)
- Push notifications are not supported
- Background sync is not available

### Android

1. Open the application in **Chrome**
2. Tap the menu (⋮) in the top-right corner
3. Tap "Add to Home screen" or "Install app"
4. Follow the on-screen prompts
5. The app will be added to your app drawer and home screen

Alternatively, a banner may appear automatically prompting installation.

## Features

### Offline Support

The service worker caches all necessary resources:
- HTML, CSS, and JavaScript files
- Images and icons
- External libraries (Three.js from CDN)

After the first visit, the app works completely offline.

### Automatic Updates

The app checks for updates using a multi-layered approach:

1. **Periodic Checks**: Every 5 minutes while the app is open
2. **Update Detection**: Monitors service worker lifecycle
3. **User Notification**: Shows banner when update is available
4. **Update Options**: User can update immediately or defer

### Update Process

When a new version is detected:
1. A notification banner appears at the top of the screen
2. User sees: "🎉 A new version is available!"
3. Two options are presented:
   - **Update Now**: Immediately applies update and reloads
   - **Later**: Dismisses banner, update applied on next visit

### Version Management

To release a new version:
1. Make your code changes
2. Update the `VERSION` constant in `sw.js`:
   ```javascript
   const VERSION = '1.0.1'; // Increment version
   ```
3. Deploy the updated files

The service worker will:
- Create a new cache with the new version number
- Download and cache updated resources
- Notify users about the available update
- Clean up old cache after activation

## Technical Details

### Cache Strategy

The implementation uses a **Cache First, Network Fallback** strategy:

```
User Request → Check Cache → Found? → Return Cached Response
                    ↓
                Not Found
                    ↓
            Fetch from Network → Cache Response → Return Response
```

This ensures:
- Fast loading times (cache first)
- Offline functionality
- Automatic caching of new resources

### Service Worker Lifecycle

1. **Install**: 
   - Service worker is downloaded
   - Resources are cached
   - Calls `skipWaiting()` for immediate activation

2. **Activate**:
   - Old caches are deleted
   - Clients are notified about updates
   - Calls `claim()` to control pages immediately

3. **Fetch**:
   - Intercepts all network requests
   - Serves cached resources when available
   - Falls back to network when needed
   - Caches new resources dynamically

### iOS Considerations

The implementation includes specific support for iOS:

- **Splash Screen**: Uses `background_color` and `theme_color` from manifest
- **Status Bar**: Configured with `black-translucent` style
- **Icons**: SVG icons work on iOS 13+
- **Standalone Mode**: Removes Safari UI when launched from home screen

### Android Considerations

- **Adaptive Icons**: Uses `purpose: "any maskable"` for adaptive icons
- **Splash Screen**: Generated automatically from manifest
- **Install Banner**: Shows native install prompt
- **Shortcuts**: Can be extended with app shortcuts in manifest

## Browser Support

### Desktop
- ✅ Chrome 67+
- ✅ Edge 79+
- ✅ Firefox 44+ (limited support)
- ✅ Safari 11.1+
- ✅ Opera 54+

### Mobile
- ✅ iOS Safari 11.3+
- ✅ Chrome for Android 67+
- ✅ Samsung Internet 8.2+
- ✅ Firefox for Android 44+ (limited)

## Troubleshooting

### Service Worker Not Registering

**Issue**: Console shows "ServiceWorker registration failed"

**Solutions**:
- Ensure you're serving over HTTPS (or localhost for development)
- Check browser console for specific error messages
- Verify `sw.js` file is accessible at `/sw.js`
- Clear browser cache and hard reload (Ctrl+Shift+R)

### App Not Installing

**Issue**: Install prompt doesn't appear

**Solutions**:
- Ensure manifest.json is properly linked in HTML
- Verify manifest.json is valid JSON
- Check that all required manifest fields are present
- Ensure serving over HTTPS
- Clear site data and revisit

### Updates Not Showing

**Issue**: New version deployed but users don't see update notification

**Solutions**:
- Verify VERSION constant was updated in `sw.js`
- Check service worker is active: DevTools → Application → Service Workers
- Force update check: DevTools → Application → Service Workers → Update
- Ensure update check interval hasn't been disabled

### iOS Specific Issues

**Issue**: App not installing on iOS

**Solutions**:
- Must use Safari browser (Chrome/Firefox won't work)
- Ensure "Add to Home Screen" option is available
- Check that iOS version is 11.3 or higher
- Verify manifest is accessible

**Issue**: Icons not showing on iOS

**Solutions**:
- Verify apple-touch-icon is properly linked
- Ensure icon URL is absolute or relative to root
- Check that icon file is accessible
- iOS requires at least 180x180 icon

## Performance Considerations

### Cache Size

The service worker caches:
- All local resources (~100KB)
- Three.js library (~600KB from CDN)
- Total cache size: ~700KB

### Update Frequency

- **Check interval**: 5 minutes (configurable)
- **Network impact**: Minimal (HEAD request to check version)
- **Battery impact**: Low (only checks when app is active)

### Best Practices

1. **Keep cache list minimal**: Only cache essential resources
2. **Use appropriate update intervals**: Balance freshness with performance
3. **Implement version strategy**: Use semantic versioning
4. **Test offline functionality**: Ensure critical features work offline
5. **Monitor cache size**: Stay under platform limits

## Security Considerations

### Content Security Policy (CSP)

The current implementation:
- Uses inline styles for update banner (contained in JS)
- Uses event listeners instead of inline onclick handlers
- Loads Three.js from trusted CDN (jsdelivr.net)

Future improvements could include:
- Adding CSP meta tag or headers
- Moving styles to external stylesheet
- Using subresource integrity (SRI) for CDN resources

### HTTPS Requirement

Service workers require HTTPS for security:
- Localhost is exempted for development
- Production must use HTTPS
- Self-signed certificates work for testing

## Future Enhancements

Potential improvements to consider:

1. **Push Notifications**: Notify users of new versions even when app is closed
2. **Background Sync**: Queue actions for when connection is restored
3. **Advanced Caching**: Implement runtime caching strategies
4. **App Shortcuts**: Add quick actions to manifest
5. **Share Target**: Allow sharing content to the app
6. **Installation Analytics**: Track PWA installations
7. **Update Prompts**: More sophisticated update UI
8. **Offline Indicators**: Visual feedback when offline

## Resources

- [MDN PWA Guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Web.dev PWA Documentation](https://web.dev/progressive-web-apps/)
- [Service Worker Specification](https://w3c.github.io/ServiceWorker/)
- [Web App Manifest Specification](https://w3c.github.io/manifest/)
- [iOS PWA Support](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)

## Support

For issues or questions about the PWA implementation:
1. Check browser console for errors
2. Review this documentation
3. Consult the resources listed above
4. Open an issue on the GitHub repository
