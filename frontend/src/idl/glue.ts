/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/glue.json`.
 */
export type Glue = {
  "address": "EVh92BTdvhGSwQ2tx3wgZftuRfsP2oXfEcUmXoSwP9Hd",
  "metadata": {
    "name": "glue",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "advanceSimulation",
      "discriminator": [
        246,
        108,
        63,
        30,
        207,
        73,
        11,
        84
      ],
      "accounts": [
        {
          "name": "arenaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  114,
                  101,
                  110,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "arena_account.host",
                "account": "arenaAccount"
              },
              {
                "kind": "arg",
                "path": "id"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "id",
          "type": "u64"
        }
      ]
    },
    {
      "name": "cancelArena",
      "discriminator": [
        104,
        161,
        139,
        47,
        18,
        111,
        92,
        43
      ],
      "accounts": [
        {
          "name": "host",
          "writable": true,
          "signer": true,
          "relations": [
            "arenaAccount"
          ]
        },
        {
          "name": "arenaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  114,
                  101,
                  110,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "arena_account.host",
                "account": "arenaAccount"
              },
              {
                "kind": "arg",
                "path": "id"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "id",
          "type": "u64"
        }
      ]
    },
    {
      "name": "claimPrize",
      "discriminator": [
        157,
        233,
        139,
        121,
        246,
        62,
        234,
        235
      ],
      "accounts": [
        {
          "name": "caller",
          "writable": true,
          "signer": true
        },
        {
          "name": "arenaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  114,
                  101,
                  110,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "arena_account.host",
                "account": "arenaAccount"
              },
              {
                "kind": "arg",
                "path": "id"
              }
            ]
          }
        },
        {
          "name": "winner",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "id",
          "type": "u64"
        }
      ]
    },
    {
      "name": "consumeRandomness",
      "discriminator": [
        190,
        217,
        49,
        162,
        99,
        26,
        73,
        234
      ],
      "accounts": [
        {
          "name": "vrfProgramIdentity",
          "docs": [
            "Scoped VRF identity PDA, bound to this program. Its presence as a signer proves",
            "the callback was issued by the VRF program for this program."
          ],
          "signer": true
        },
        {
          "name": "arenaAccount",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "randomness",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "delegate",
      "discriminator": [
        90,
        147,
        75,
        178,
        85,
        88,
        4,
        137
      ],
      "accounts": [
        {
          "name": "host",
          "writable": true,
          "signer": true
        },
        {
          "name": "bufferArenaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "arenaAccount"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                200,
                129,
                147,
                195,
                42,
                17,
                148,
                95,
                41,
                229,
                205,
                18,
                174,
                8,
                125,
                192,
                17,
                222,
                185,
                247,
                51,
                226,
                108,
                68,
                248,
                191,
                3,
                58,
                219,
                35,
                162,
                212
              ]
            }
          }
        },
        {
          "name": "delegationRecordArenaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "arenaAccount"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataArenaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "arenaAccount"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "arenaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  114,
                  101,
                  110,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "arg",
                "path": "id"
              }
            ]
          }
        },
        {
          "name": "validator"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "ownerProgram",
          "address": "EVh92BTdvhGSwQ2tx3wgZftuRfsP2oXfEcUmXoSwP9Hd"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        }
      ],
      "args": [
        {
          "name": "id",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initArena",
      "discriminator": [
        24,
        246,
        252,
        176,
        155,
        175,
        123,
        124
      ],
      "accounts": [
        {
          "name": "host",
          "writable": true,
          "signer": true
        },
        {
          "name": "arenaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  114,
                  101,
                  110,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "arg",
                "path": "id"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "id",
          "type": "u64"
        },
        {
          "name": "entryFee",
          "type": "u64"
        }
      ]
    },
    {
      "name": "joinArena",
      "discriminator": [
        135,
        217,
        203,
        200,
        93,
        181,
        131,
        47
      ],
      "accounts": [
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "arenaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  114,
                  101,
                  110,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "arena_account.host",
                "account": "arenaAccount"
              },
              {
                "kind": "arg",
                "path": "id"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "id",
          "type": "u64"
        }
      ]
    },
    {
      "name": "processUndelegation",
      "discriminator": [
        196,
        28,
        41,
        206,
        48,
        37,
        51,
        167
      ],
      "accounts": [
        {
          "name": "baseAccount",
          "writable": true
        },
        {
          "name": "buffer",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  110,
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  101,
                  45,
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "baseAccount"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                181,
                183,
                0,
                225,
                242,
                87,
                58,
                192,
                204,
                6,
                34,
                1,
                52,
                74,
                207,
                151,
                184,
                53,
                6,
                235,
                140,
                229,
                25,
                152,
                204,
                98,
                126,
                24,
                147,
                128,
                167,
                62
              ]
            }
          }
        },
        {
          "name": "payer",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "accountSeeds",
          "type": {
            "vec": "bytes"
          }
        }
      ]
    },
    {
      "name": "requestRandomness",
      "discriminator": [
        213,
        5,
        173,
        166,
        37,
        236,
        31,
        18
      ],
      "accounts": [
        {
          "name": "host",
          "writable": true,
          "signer": true,
          "relations": [
            "arenaAccount"
          ]
        },
        {
          "name": "arenaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  114,
                  101,
                  110,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "arena_account.host",
                "account": "arenaAccount"
              },
              {
                "kind": "arg",
                "path": "id"
              }
            ]
          }
        },
        {
          "name": "oracleQueue",
          "writable": true
        },
        {
          "name": "programIdentity",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  100,
                  101,
                  110,
                  116,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "vrfProgram",
          "address": "Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz"
        },
        {
          "name": "slotHashes",
          "address": "SysvarS1otHashes111111111111111111111111111"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "id",
          "type": "u64"
        }
      ]
    },
    {
      "name": "scheduleAdvance",
      "discriminator": [
        210,
        107,
        216,
        24,
        110,
        197,
        42,
        77
      ],
      "accounts": [
        {
          "name": "magicProgram"
        },
        {
          "name": "host",
          "writable": true,
          "signer": true
        },
        {
          "name": "arenaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  114,
                  101,
                  110,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "arg",
                "path": "id"
              }
            ]
          }
        },
        {
          "name": "program"
        }
      ],
      "args": [
        {
          "name": "id",
          "type": "u64"
        },
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "scheduleAdvanceArgs"
            }
          }
        }
      ]
    },
    {
      "name": "settleArena",
      "discriminator": [
        222,
        130,
        112,
        108,
        20,
        135,
        200,
        13
      ],
      "accounts": [
        {
          "name": "host",
          "writable": true,
          "signer": true,
          "relations": [
            "arenaAccount"
          ]
        },
        {
          "name": "arenaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  114,
                  101,
                  110,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "arena_account.host",
                "account": "arenaAccount"
              },
              {
                "kind": "arg",
                "path": "id"
              }
            ]
          }
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "id",
          "type": "u64"
        }
      ]
    },
    {
      "name": "startArena",
      "discriminator": [
        76,
        99,
        3,
        235,
        111,
        167,
        248,
        5
      ],
      "accounts": [
        {
          "name": "host",
          "writable": true,
          "signer": true,
          "relations": [
            "arenaAccount"
          ]
        },
        {
          "name": "arenaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  114,
                  101,
                  110,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "arena_account.host",
                "account": "arenaAccount"
              },
              {
                "kind": "arg",
                "path": "id"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "id",
          "type": "u64"
        }
      ]
    },
    {
      "name": "upgradeBot",
      "discriminator": [
        42,
        187,
        84,
        116,
        40,
        236,
        218,
        134
      ],
      "accounts": [
        {
          "name": "player",
          "signer": true
        },
        {
          "name": "arenaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  114,
                  101,
                  110,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "arena_account.host",
                "account": "arenaAccount"
              },
              {
                "kind": "arg",
                "path": "id"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "id",
          "type": "u64"
        },
        {
          "name": "upgrade",
          "type": {
            "defined": {
              "name": "upgradeType"
            }
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "arenaAccount",
      "discriminator": [
        83,
        227,
        135,
        58,
        80,
        196,
        10,
        188
      ]
    }
  ],
  "events": [
    {
      "name": "arenaSettled",
      "discriminator": [
        54,
        201,
        162,
        154,
        85,
        183,
        209,
        60
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidArena",
      "msg": "Invalid Arena"
    },
    {
      "code": 6001,
      "name": "arenaFull",
      "msg": "Arena full"
    },
    {
      "code": 6002,
      "name": "notEnoughPlayers",
      "msg": "Not Enough Players"
    },
    {
      "code": 6003,
      "name": "playerAlreadyInArena",
      "msg": "Player already in Arena"
    },
    {
      "code": 6004,
      "name": "arenaNotJoinable",
      "msg": "Arena not joinable"
    },
    {
      "code": 6005,
      "name": "randomnessNotReady",
      "msg": "Randomness not ready"
    },
    {
      "code": 6006,
      "name": "unableToFindSpawnPosition",
      "msg": "Unable to find spawn position"
    },
    {
      "code": 6007,
      "name": "arenaNotRunning",
      "msg": "Arena not running"
    },
    {
      "code": 6008,
      "name": "unauthorizedSigner",
      "msg": "Unauthorized Signer"
    },
    {
      "code": 6009,
      "name": "gameOver",
      "msg": "Game Over"
    },
    {
      "code": 6010,
      "name": "counterOverflow",
      "msg": "Counter Overflow"
    },
    {
      "code": 6011,
      "name": "noResourceSlot",
      "msg": "No Resource Slot"
    },
    {
      "code": 6012,
      "name": "noValidSpawnPosition",
      "msg": "No Valid Spawn Position"
    },
    {
      "code": 6013,
      "name": "playerNotInArena",
      "msg": "Player is not in this arena"
    },
    {
      "code": 6014,
      "name": "insufficientCredits",
      "msg": "Not enough credits"
    },
    {
      "code": 6015,
      "name": "upgradeOverflow",
      "msg": "Upgrade would overflow"
    },
    {
      "code": 6016,
      "name": "entryFeeError",
      "msg": "Entry fee must be greater than 0"
    },
    {
      "code": 6017,
      "name": "noActiveBots",
      "msg": "No Active Bots"
    },
    {
      "code": 6018,
      "name": "arenaNotFinished",
      "msg": "Arena Not Finished"
    },
    {
      "code": 6019,
      "name": "prizeAlreadyClaimed",
      "msg": "Prize Already Claimed"
    },
    {
      "code": 6020,
      "name": "arenaNotCancellable",
      "msg": "Arena Not Cancellable"
    },
    {
      "code": 6021,
      "name": "notWinner",
      "msg": "Arena Not Cancellable"
    },
    {
      "code": 6022,
      "name": "invalidRefundAccount",
      "msg": "Invalid Refund Account"
    },
    {
      "code": 6023,
      "name": "missingRefundAccounts",
      "msg": "Missing Refund Account"
    }
  ],
  "types": [
    {
      "name": "arenaAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "host",
            "type": "pubkey"
          },
          {
            "name": "players",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "bots",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "bot"
                  }
                },
                6
              ]
            }
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "arenaStatus"
              }
            }
          },
          {
            "name": "vrfSeed",
            "type": {
              "option": {
                "array": [
                  "u8",
                  32
                ]
              }
            }
          },
          {
            "name": "spawnCounter",
            "type": "u32"
          },
          {
            "name": "resources",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "resource"
                  }
                },
                20
              ]
            }
          },
          {
            "name": "tick",
            "type": "u64"
          },
          {
            "name": "maxTicks",
            "type": "u64"
          },
          {
            "name": "entryFee",
            "type": "u64"
          },
          {
            "name": "winner",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "arenaSettled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "arenaId",
            "type": "u64"
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "score",
            "type": "u64"
          },
          {
            "name": "payout",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "arenaStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "waiting"
          },
          {
            "name": "running"
          },
          {
            "name": "finished"
          }
        ]
      }
    },
    {
      "name": "bot",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "x",
            "type": "i16"
          },
          {
            "name": "y",
            "type": "i16"
          },
          {
            "name": "vision",
            "type": "u16"
          },
          {
            "name": "speed",
            "type": "u16"
          },
          {
            "name": "score",
            "type": "u64"
          },
          {
            "name": "credits",
            "type": "u64"
          },
          {
            "name": "active",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "resource",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "x",
            "type": "i16"
          },
          {
            "name": "y",
            "type": "i16"
          },
          {
            "name": "active",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "scheduleAdvanceArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "taskId",
            "type": "i64"
          },
          {
            "name": "executionIntervalMillis",
            "type": "i64"
          },
          {
            "name": "iterations",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "upgradeType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "speed"
          },
          {
            "name": "vision"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "startingCredits",
      "type": "u64",
      "value": "100"
    }
  ]
};
