# Artifact delivery

Use the available Artifact tool's schema for publishing and revisions. `template.html` is a fragment: when the tool supplies the document wrapper, keep that shape. If it requires a complete document, add the wrapper and document metadata.

Publish the page and return the URL the tool reports. For revisions, update the existing artifact when the tool supports it; report the resulting URL without assuming it stays the same.
