// Minimal ambient declarations for the parts of the File System Access API that
// are not yet in TypeScript's standard lib.dom (the WICG permission methods and
// window.showDirectoryPicker). The core handle types (FileSystemDirectoryHandle,
// FileSystemFileHandle, createWritable, removeEntry, values, …) already ship in
// lib.dom; here we only augment the missing surface. See §Phase 1 of the roadmap.

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite'
}

interface FileSystemHandle {
  queryPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  requestPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
}

// Async iteration over directory entries is shipped in browsers but absent from this
// TS version's lib.dom; declare the surface fsaTarget.listPaths() relies on.
interface FileSystemDirectoryHandle {
  values(): AsyncIterableIterator<FileSystemHandle>
}

interface DirectoryPickerOptions {
  id?: string
  mode?: 'read' | 'readwrite'
  startIn?: FileSystemHandle | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos'
}

interface Window {
  showDirectoryPicker?(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>
}
