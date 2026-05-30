export function pdfDataUrlToBytes(dataUrl: string): Uint8Array {
  const [metadata, base64Data] = dataUrl.split(',', 2)

  if (!metadata || !base64Data || !/^data:application\/pdf(?:;[^,]*)?;base64$/i.test(metadata)) {
    throw new Error('Invalid PDF data URL')
  }

  const binary = atob(base64Data)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}
