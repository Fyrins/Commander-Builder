<?php

namespace App\EventListener;

use Lexik\Bundle\JWTAuthenticationBundle\Event\AuthenticationSuccessEvent;
use Symfony\Component\HttpFoundation\Cookie;

/**
 * À la connexion réussie, pose le JWT dans un cookie HttpOnly au lieu
 * de le renvoyer dans le body JSON.
 */
class JWTAuthenticationSuccessListener
{
    public function __construct(
        private int $tokenTtl,
        private string $cookieDomain = '',
        private bool $secureCookie = true,
    ) {
    }

    public function onAuthenticationSuccess(AuthenticationSuccessEvent $event): void
    {
        $response = $event->getResponse();
        $data = $event->getData();
        $token = $data['token'] ?? '';

        $cookie = Cookie::create('auth_token')
            ->withValue($token)
            ->withHttpOnly(true)
            ->withSecure($this->secureCookie)
            ->withSameSite('lax')
            ->withPath('/')
            ->withExpires(time() + $this->tokenTtl);

        if ($this->cookieDomain) {
            $cookie = $cookie->withDomain($this->cookieDomain);
        }

        $response->headers->setCookie($cookie);

        // Ne pas exposer le token dans le body JSON.
        $event->setData(['success' => true]);
    }
}
