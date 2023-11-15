'use client'

import { Avatar, Button, Center, HStack, Icon, Popover, PopoverArrow, PopoverBody, PopoverContent, PopoverFooter, PopoverHeader, PopoverTrigger, Portal, Text, Tooltip, VStack, useBoolean, useClipboard, useColorModeValue } from "@chakra-ui/react";
import { FaCheckCircle, FaChevronDown, FaChevronRight, FaChevronUp, FaCopy, FaPowerOff, FaRedo } from "react-icons/fa"
import { FiBell, FiMenu } from "react-icons/fi"
import { BiWalletAlt } from "react-icons/bi"
import { useSession } from "@/hooks/useSession";
import { formatAddress } from "@/utils";
import { useState } from "react";

export default function UserProfile() {
  const {userAddress,username} = useSession()
  const [isAccountDetailOpen, setIsAccountDetailOpen] = useBoolean()
  const [ethBalance,setEthBalance] = useState('0')
  const _portalBg = useColorModeValue("white", "gray.900")
	const _portalBorderBg = useColorModeValue("gray.200", "gray.700")
  const { onCopy, value, setValue:setWalletAddress, hasCopied } = useClipboard("");
  const handleDisconnect = () => {

  }
  const handleCopyWalletAddress = () => {
    setWalletAddress(userAddress)
    onCopy()
  }

  return (
    <Popover isOpen={isAccountDetailOpen} onOpen={setIsAccountDetailOpen.on} onClose={setIsAccountDetailOpen.off}
      placement="bottom-end" isLazy
    >
      <PopoverTrigger>
        <Button  bg="none"
          leftIcon={ <Avatar size="sm" /> }
          rightIcon={
            isAccountDetailOpen ? (
              <Icon w={3} h={3} as={FaChevronUp} />
            ) : (
              <Icon w={3} h={3} as={FaChevronDown} />
            )
          }
          variant="ghost"
          _focus={{ boxShadow: "none", background: "none" }}
          _hover={{ background: "none" }}
        >
          {username}
        </Button>
      </PopoverTrigger>
      <Portal>
        <PopoverContent bg={_portalBg} borderColor={_portalBorderBg}>
          <PopoverArrow />
          <PopoverHeader borderBottomWidth="0px">
            <HStack justify="space-between">
              <HStack>
                <Icon aria-label="wallet" as={BiWalletAlt} />
                <Text> {formatAddress(userAddress)}
                </Text>
              </HStack>
              <HStack spacing="1">
              <Tooltip hasArrow label={hasCopied?'Copied':'Copy'} >
                <Button size="sm" onClick={handleCopyWalletAddress}>
                  <Icon w={3} h={3} as={FaCopy} />
                </Button>
              </Tooltip>
                
                <Button
                  onClick={handleDisconnect}
                  colorScheme="red"
                  size="sm"
                >
                  <Icon w={3} h={3} as={FaPowerOff} />
                </Button>
              </HStack>
            </HStack>
          </PopoverHeader>
          <PopoverBody>
            <Center>
              <VStack spacing="1">
                <Text fontSize="2xl">{ethBalance}</Text>
                <Text fontSize="3xl">ETH</Text>
              </VStack>
            </Center>
          </PopoverBody>
        </PopoverContent>
      </Portal>
    </Popover>
  );
}
