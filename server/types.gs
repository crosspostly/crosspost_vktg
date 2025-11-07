/**
 * VK→Telegram Crossposter - TYPE DEFINITIONS
 * Shared type definitions for all modules
 * 
 * Автор: f_den
 * Дата: 2025-11-07
 */

// ============================================
// COMMON TYPE DEFINITIONS
// ============================================

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Whether the operation was successful
 * @property {*} [data] - Response data payload
 * @property {string} [error] - Error message if operation failed
 * @property {number} [status] - HTTP status code
 */

/**
 * @typedef {Object} VkPost
 * @property {number} id - Post ID
 * @property {number} from_id - Author ID
 * @property {number} owner_id - Owner ID  
 * @property {number} date - Post timestamp
 * @property {string} [text] - Post text content
 * @property {Array<VkAttachment>} [attachments] - Media attachments
 * @property {Object} [comments] - Comments info
 * @property {Object} [likes] - Likes info
 * @property {Object} [reposts] - Reposts info
 * @property {number} [post_type] - Post type identifier
 * @property {Object} [copy_history] - Reposted content
 */

/**
 * @typedef {Object} VkAttachment
 * @property {string} type - Attachment type (photo, video, audio, doc, link)
 * @property {VkPhoto|VkVideo|VkAudio|VkDoc|VkLink} [photo|video|audio|doc|link] - Attachment data
 */

/**
 * @typedef {Object} VkPhoto
 * @property {number} id - Photo ID
 * @property {number} owner_id - Owner ID
 * @property {string} [access_key] - Access key
 * @property {Array<VkPhotoSize>} sizes - Available photo sizes
 * @property {string} [text] - Photo caption
 * @property {number} date - Upload date
 */

/**
 * @typedef {Object} VkPhotoSize
 * @property {string} url - Image URL
 * @property {number} width - Image width
 * @property {number} height - Image height
 * @property {string} type - Size type (s,m,x,o,p,q,r,y,z,w)
 */

/**
 * @typedef {Object} VkVideo
 * @property {number} id - Video ID
 * @property {number} owner_id - Owner ID
 * @property {string} title - Video title
 * @property {string} description - Video description
 * @property {number} duration - Duration in seconds
 * @property {Array<VkImage>} [image] - Video thumbnails
 * @property {string} [player] - Embed player URL
 * @property {number} date - Upload date
 * @property {number} [views] - View count
 * @property {string} [access_key] - Access key
 */

/**
 * @typedef {Object} VkImage
 * @property {string} url - Image URL
 * @property {number} width - Image width
 * @property {number} height - Image height
 * @property {boolean} with_padding - Whether image has padding
 */

/**
 * @typedef {Object} VkAudio
 * @property {number} id - Audio ID
 * @property {number} owner_id - Owner ID
 * @property {string} artist - Artist name
 * @property {string} title - Track title
 * @property {number} duration - Duration in seconds
 * @property {string} url - Audio file URL
 * @property {number} date - Upload date
 */

/**
 * @typedef {Object} VkDoc
 * @property {number} id - Document ID
 * @property {number} owner_id - Owner ID
 * @property {string} title - Document title
 * @property {number} size - File size in bytes
 * @property {string} ext - File extension
 * @property {string} url - Download URL
 * @property {number} date - Upload date
 */

/**
 * @typedef {Object} VkLink
 * @property {string} url - Link URL
 * @property {string} title - Link title
 * @property {string} [description] - Link description
 * @property {VkImage} [image] - Link preview image
 */

/**
 * @typedef {Object} BindingConfig
 * @property {string} bindingId - Unique binding identifier
 * @property {string} licenseKey - Associated license key
 * @property {string} vkGroupId - VK group ID
 * @property {string} vkGroupName - VK group name
 * @property {string} telegramChatId - Telegram chat ID
 * @property {string} telegramChatTitle - Telegram chat title
 * @property {string} name - Binding display name
 * @property {string} [description] - Binding description
 * @property {Object} [formatSettings] - Formatting options
 * @property {boolean} [formatSettings.boldFirstLine] - Bold first line
 * @property {boolean} [formatSettings.boldUppercase] - Bold uppercase words
 * @property {Date} [createdAt] - Creation timestamp
 * @property {Date} [updatedAt] - Last update timestamp
 * @property {string} [status] - Binding status (active/inactive)
 */

/**
 * @typedef {Object} LicenseRecord
 * @property {string} licenseKey - Unique license key
 * @property {string} type - License type (trial/pro/enterprise)
 * @property {string} status - License status (active/inactive/expired)
 * @property {Date} expires - Expiration date
 * @property {number} maxGroups - Maximum allowed bindings
 * @property {string} [email] - User email
 * @property {string} [notes] - Additional notes
 * @property {Date} [createdAt] - Creation timestamp
 * @property {Date} [updatedAt] - Last update timestamp
 */

/**
 * @typedef {Object} TelegramMessage
 * @property {number} message_id - Message ID
 * @property {Object} [chat] - Chat information
 * @property {number} chat.id - Chat ID
 * @property {string} [chat.type] - Chat type
 * @property {string} [chat.title] - Chat title
 * @property {string} [chat.username] - Chat username
 * @property {string} [text] - Message text
 * @property {number} [date] - Message timestamp
 * @property {Array<Object>} [photo] - Photo attachments
 * @property {Object} [video] - Video attachment
 * @property {Object} [audio] - Audio attachment
 * @property {Object} [document] - Document attachment
 */

/**
 * @typedef {Object} PublicationRecord
 * @property {Date} timestamp - Publication timestamp
 * @property {string} status - Publication status (success/partial/error)
 * @property {string} vkGroupId - Source VK group ID
 * @property {number} vkPostId - Source VK post ID
 * @property {string} vkPostUrl - Source VK post URL
 * @property {Date} vkPostDate - VK post date
 * @property {string} mediaSummary - Media attachments summary
 * @property {number} captionChars - Caption character count
 * @property {number} captionParts - Number of caption parts sent
 * @property {string} tgChat - Target Telegram chat
 * @property {Array<number>} tgMessageIds - Sent Telegram message IDs
 * @property {Array<string>} tgMessageUrls - Telegram message URLs
 * @property {string} [notes] - Additional notes or errors
 */

/**
 * @typedef {Object} FormatOptions
 * @property {boolean} [boldFirstLine=true] - Bold first line of text
 * @property {boolean} [boldUppercase=true] - Bold uppercase words (2+ chars)
 */

/**
 * @typedef {Object} VkApiResponse
 * @property {Object} response - VK API response data
 * @property {Array<VkPost>} response.items - Posts array
 * @property {number} response.count - Total posts count
 * @property {Object} [response.profiles] - User profiles
 * @property {Object} [response.groups] - Group profiles
 * @property {Object} [error] - VK API error info
 * @property {number} [error.error_code] - Error code
 * @property {string} [error.error_msg] - Error message
 */

/**
 * @typedef {Object} TelegramApiResponse
 * @property {boolean} ok - Whether request was successful
 * @property {*} [result] - Response result
 * @property {Object} [error] - Error information
 * @property {number} [error.error_code] - Error code
 * @property {string} [error.description] - Error description
 */

/**
 * @typedef {Object} LogEntry
 * @property {Date} timestamp - Log timestamp
 * @property {string} level - Log level (DEBUG/INFO/WARN/ERROR)
 * @property {string} event - Event type
 * @property {string} licenseKey - Associated license key
 * @property {string} message - Log message
 * @property {Object} [metadata] - Additional metadata
 */

/**
 * @typedef {Object} SheetData
 * @property {Array<Array<string|number|Date>>} data - Sheet data rows
 * @property {Array<string>} headers - Column headers
 * @property {number} rowCount - Number of rows
 * @property {number} columnCount - Number of columns
 */

/**
 * @typedef {Object} CacheEntry
 * @property {*} data - Cached data
 * @property {Date} timestamp - Cache timestamp
 * @property {number} [ttl] - Time to live in seconds
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string} [error] - Validation error message
 * @property {*} [normalized] - Normalized value
 */