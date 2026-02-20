# Implementation Plan for Notion File Upload

## Overview

We will implement support for uploading images directly to Notion using the `v1/file_uploads` API. This allows us to circumvent URL length limits (Data URIs) and broken external links by hosting the images within Notion.

## Steps

1.  **Update Types (`src/types/index.ts`)**:
    - Add `NotionFileUpload` interface matching the API response.

2.  **Update Request Service (`src/utils/request.ts`)**:
    - Add `uploadFileToNotion(fileUploadId: string, formData: FormData): Promise<any>` method to handle `multipart/form-data` requests correctly.

3.  **Update Notion Service (`src/services/notion.ts`)**:
    - Add `uploadFile(file: Blob, filename: string): Promise<string>` method.
      - Calls `POST /v1/file_uploads` to initiate upload.
      - Calls `requestService.uploadFileToNotion` to send the file.
      - Returns the file upload ID.
    - Update `createPage` to accept `imagesMap` which can contain file upload IDs.
    - Update block creation logic:
      - Check if the image identifier is a UUID (indicating a file upload).
      - If UUID: create block with `{ type: "image", image: { type: "file_upload", file_upload: { "file_upload_id": id } } }`.
      - If URL: create block with `{ type: "image", image: { type: "external", external: { "url": url } } }`.

4.  **Update Image Service (`src/services/image.ts`)**:
    - Ensure `downloadImages` returns blobs successfully for processing.
    - (Optional) Refactor `processImagesForNotion` if needed, but likely `background/index.ts` will handle the orchestration.

5.  **Update Background Script (`src/background/index.ts`)**:
    - In `handleSaveToNotion`:
      - Call `ImageService.downloadImages` to get blobs.
      - Iterate through successful downloads and call `NotionService.uploadFile` for each.
      - Construct `imagesMap` mapping original URL -> File Upload ID.
      - Pass to `NotionService.createPage`.
