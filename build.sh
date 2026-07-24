#!/bin/bash

# Install Chrome and dependencies for Puppeteer
apt-get update
apt-get install -y \
  wget \
    gnupg \
      unzip \
        chromium-browser \
          libxss1 \
            libappindicator1 \
              libindicator7 \
                xdg-utils \
                  fonts-liberation \
                    libappindicator3-1 \
                      libatk-bridge2.0-0 \
                        libatk1.0-0 \
                          libc6 \
                            libcairo2 \
                              libcups2 \
                                libgcc1 \
                                  libgdk-pixbuf2.0-0 \
                                    libglib2.0-0 \
                                      libgtk-3-0 \
                                        libpango-1.0-0 \
                                          libpango-cairo-1.0-0 \
                                            libstdc++6 \
                                              libx11-6 \
                                                libx11-xcb1 \
                                                  libxcb1 \
                                                    libxcomposite1 \
                                                      libxcursor1 \
                                                        libxdamage1 \
                                                          libxext6 \
                                                            libxfixes3 \
                                                              libxi6 \
                                                                libxinerama1 \
                                                                  libxrandr2 \
                                                                    libxrender1 \
                                                                      libxss1 \
                                                                        libxtst6

                                                                        echo "Chrome dependencies installed"
