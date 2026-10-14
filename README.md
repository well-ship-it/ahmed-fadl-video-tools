# Ahmed Fadl – Video Tools

A Tampermonkey userscript that adds video statistics and convenience buttons
to supported course video pages.

## Installation

1. Install Tampermonkey.
2. Open `ahmed-fadl-video-tools.user.js` from this repository.
3. Install the userscript and visit a supported video page.

## Remote kill switch

Edit `config.json` on the `main` branch.

Enable:
```json
{
  "enabled": true,
  "message": "Video Tools enabled.",
  "minimumVersion": "1.0.0"
}
```

Disable:
```json
{
  "enabled": false,
  "message": "Video Tools are temporarily disabled.",
  "minimumVersion": "1.0.0"
}
```

The script checks the remote configuration every five minutes and fails closed
when the configuration cannot be verified. A reload may be needed to restart
features after re-enabling.

## Permissions and privacy

The script reads its configuration from GitHub and sends progress-update
requests to the course website. Review the code before installing.

The download button opens a third-party service. Its availability, terms and
privacy practices are outside this project's control.

Use the progress feature only as permitted by the course website. Downloads
must comply with applicable law and the rights of the video owner.

## Limitations

The remote switch is an operational control, not a security boundary.
It cannot prevent users from modifying their local copies. An HTTP success
response does not prove that the server permanently stored progress.

## License

MIT. See `LICENSE`.