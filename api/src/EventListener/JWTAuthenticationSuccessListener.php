<?php

namespace App\EventListener;

use App\Security\AuthCookieFactory;
use Lexik\Bundle\JWTAuthenticationBundle\Event\AuthenticationSuccessEvent;

/**
 * À la connexion réussie, pose le JWT dans un cookie HttpOnly au lieu
 * de le renvoyer dans le body JSON.
 */
class JWTAuthenticationSuccessListener
{
    public function __construct(
        private readonly AuthCookieFactory $cookieFactory,
    ) {
    }

    public function onAuthenticationSuccess(AuthenticationSuccessEvent $event): void
    {
        $response = $event->getResponse();
        $token = $event->getData()['token'] ?? '';

        $response->headers->setCookie($this->cookieFactory->create((string) $token));

        // Ne pas exposer le token dans le body JSON.
        $event->setData(['success' => true]);
    }
}
