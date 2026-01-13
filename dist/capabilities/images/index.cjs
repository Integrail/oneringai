'use strict';

// src/domain/interfaces/IDisposable.ts
function assertNotDestroyed(obj, operation) {
  if (obj.isDestroyed) {
    throw new Error(`Cannot ${operation}: instance has been destroyed`);
  }
}

// src/capabilities/images/ImageManager.ts
var ImageManager = class {
  constructor(registry) {
    this.registry = registry;
  }
  _isDestroyed = false;
  get isDestroyed() {
    return this._isDestroyed;
  }
  /**
   * Generate images from text prompt
   */
  async generate(options) {
    assertNotDestroyed(this, "generate image");
    const provider = await this.registry.getImageProvider(options.model.split("/")[0] || "openai");
    return provider.generateImage(options);
  }
  /**
   * Edit an existing image
   */
  async edit(options) {
    assertNotDestroyed(this, "edit image");
    const providerName = options.model.split("/")[0] || "openai";
    const provider = await this.registry.getImageProvider(providerName);
    if (!provider.editImage) {
      throw new Error(`Provider ${providerName} does not support image editing`);
    }
    return provider.editImage(options);
  }
  /**
   * Create variations of an image
   */
  async createVariation(options) {
    assertNotDestroyed(this, "create image variation");
    const providerName = options.model.split("/")[0] || "openai";
    const provider = await this.registry.getImageProvider(providerName);
    if (!provider.createVariation) {
      throw new Error(`Provider ${providerName} does not support image variations`);
    }
    return provider.createVariation(options);
  }
  /**
   * Destroy the manager and release resources
   * Safe to call multiple times (idempotent)
   */
  destroy() {
    if (this._isDestroyed) {
      return;
    }
    this._isDestroyed = true;
  }
};

exports.ImageManager = ImageManager;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map